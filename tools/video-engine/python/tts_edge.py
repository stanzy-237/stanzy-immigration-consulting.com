"""Voice: script.json -> build/voice.wav + build/timeline.json with exact word timings.

Narrator videos use config.voice; dialogue videos pick each line's voice from
config.cast[who].voice. Phrases marked "cont" are spoken in the same breath as the
previous one (one synthesis), then split back into subtitle phrases.

Usage: python3 tts_edge.py --project DIR --hash SOURCE_HASH --cache DIR
"""
import argparse
import asyncio
import hashlib
import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg

from pron_fr import clean_spoken, load_dictionary, normalize_for_match, speak_word, split_words

SAMPLE_RATE = 24000
LEAD, GAP, SCENE_GAP, TAIL = 0.6, 0.3, 0.5, 2.5  # mirrors engine/core.js estimateTimeline
TRIM_AFTER_SPEECH = 0.25
DEFAULT_VOICE = "fr-CA-ThierryNeural"


def log(msg):
    print(f"  {msg}", flush=True)


# ---------- synthesis (cached, retried) ----------
async def _synthesize(text, voice, rate, pitch):
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    audio, bounds = bytearray(), []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            bounds.append({"t": chunk["offset"] / 1e7, "d": chunk["duration"] / 1e7, "text": chunk["text"]})
    if not audio:
        raise RuntimeError("aucun audio reçu")
    return bytes(audio), bounds


def synthesize(text, voice, rate, pitch, cache_dir):
    key = hashlib.sha1(f"{voice}|{rate}|{pitch}|{text}".encode("utf-8")).hexdigest()[:20]
    mp3, meta = cache_dir / f"{key}.mp3", cache_dir / f"{key}.json"
    if mp3.exists() and meta.exists():
        return mp3, json.loads(meta.read_text(encoding="utf-8")), True
    last = None
    for attempt in range(1, 6):
        try:
            audio, bounds = asyncio.run(_synthesize(text, voice, rate, pitch))
            mp3.write_bytes(audio)
            meta.write_text(json.dumps(bounds, ensure_ascii=False), encoding="utf-8")
            return mp3, bounds, False
        except Exception as e:  # 403 / network hiccups from the edge endpoint
            last = e
            wait = 2 * attempt
            log(f"⚠ tentative {attempt}/5 échouée ({e.__class__.__name__}) — nouvel essai dans {wait} s")
            time.sleep(wait)
    raise RuntimeError(f"Synthèse impossible après 5 tentatives : {last}")


def decode_pcm(path):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    out = subprocess.run(
        [ffmpeg, "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"],
        check=True, capture_output=True,
    )
    return out.stdout


# ---------- alignment: TTS word boundaries -> displayed words ----------
def align(spoken_parts, bounds):
    """Return [(start, end)] relative to the audio, one per displayed word."""
    stream, owner = [], []
    for i, part in enumerate(spoken_parts):
        for ch in normalize_for_match(part):
            stream.append(ch)
            owner.append(i)
    stream = "".join(stream)
    times = [None] * len(spoken_parts)
    pos = 0
    for b in bounds:
        nb = normalize_for_match(b["text"])
        if not nb:
            continue
        idx = stream.find(nb, pos)
        if idx < 0:
            continue
        for k in range(idx, idx + len(nb)):
            i = owner[k]
            s, e = b["t"], b["t"] + b["d"]
            times[i] = (s, e) if times[i] is None else (min(times[i][0], s), max(times[i][1], e))
        pos = idx + len(nb)
    for i, tv in enumerate(times):
        if tv is None:
            prev_end = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            next_start = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev_end + 0.15)
            times[i] = (prev_end, max(prev_end + 0.05, next_start))
    out = []
    for i, (s, e) in enumerate(times):
        nxt = times[i + 1][0] if i + 1 < len(times) else e
        out.append((s, max(e, nxt) if i + 1 < len(times) else e))
    return out


def voice_for(phrase, config):
    cast = config.get("cast")
    base = (cast[phrase["who"]].get("voice") if cast else config.get("voice")) or {}
    tone = phrase.get("tone") or {}
    return (base.get("name") or DEFAULT_VOICE,
            tone.get("rate") or base.get("rate") or "+0%",
            tone.get("pitch") or base.get("pitch") or "+0Hz")


def groups_of(script):
    groups = []
    for p in script:
        if p.get("cont") and groups:
            groups[-1].append(p)
        else:
            groups.append([p])
    return groups


# ---------- assembly ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--hash", required=True)
    ap.add_argument("--cache", required=True)
    args = ap.parse_args()

    project = Path(args.project)
    cache_dir = Path(args.cache)
    cache_dir.mkdir(parents=True, exist_ok=True)
    build = project / "build"
    build.mkdir(exist_ok=True)

    script = json.loads((project / "script.json").read_text(encoding="utf-8"))
    config = json.loads((project / "config.json").read_text(encoding="utf-8"))
    dictionary = load_dictionary(config.get("pron"))
    bytes_per_sec = SAMPLE_RATE * 2
    pacing = config.get("pacing") or {}
    gap = float(pacing.get("gap", GAP))
    scene_gap = float(pacing.get("sceneGap", SCENE_GAP))

    pcm = bytearray()
    phrases = []
    cursor = LEAD
    prev_scene = None
    hits = 0
    for group in groups_of(script):
        first = group[0]
        voice, rate, pitch = voice_for(first, config)
        words_per = [split_words(p["text"]) for p in group]
        parts_per = [[speak_word(w, dictionary) for w in ws] for ws in words_per]
        all_parts = [s for parts in parts_per for s in parts]
        spoken = clean_spoken(" ".join(s for s in all_parts if s))
        mp3, bounds, cached = synthesize(spoken, voice, rate, pitch, cache_dir)
        hits += cached
        audio = decode_pcm(mp3)
        timings = align(all_parts, bounds)
        speech_end = max(e for _, e in timings)
        keep = min(len(audio), int((speech_end + TRIM_AFTER_SPEECH) * SAMPLE_RATE) * 2)
        audio = audio[:keep]

        if prev_scene is not None and first["scene"] != prev_scene:
            cursor += scene_gap
        cursor += float(first.get("pause", 0))
        prev_scene = first["scene"]
        start = cursor
        pcm += b"\x00\x00" * (int(round(start * SAMPLE_RATE)) - len(pcm) // 2)
        pcm += audio

        k = 0
        for p, words in zip(group, words_per):
            tw = timings[k:k + len(words)]
            k += len(words)
            phrases.append({
                "id": p["id"], "scene": p["scene"], "who": p.get("who"), "text": p["text"],
                "spoken": " ".join(s for s in parts_per[group.index(p)] if s),
                "start": round(start + tw[0][0], 3), "end": round(start + tw[-1][1], 3),
                "words": [{"w": w, "start": round(start + s, 3), "end": round(start + e, 3)} for w, (s, e) in zip(words, tw)],
            })
        who = f"{first.get('who')}: " if first.get("who") else ""
        log(f"{'↺' if cached else '♪'} {'+'.join(p['id'] for p in group)}  {who}{spoken}")
        cursor = start + len(audio) / bytes_per_sec + gap

    duration = round(phrases[-1]["end"] + TAIL, 3)
    pcm += b"\x00\x00" * max(0, int(duration * SAMPLE_RATE) - len(pcm) // 2)

    with wave.open(str(build / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(pcm))
    timeline = {"duration": duration, "estimated": False, "sourceHash": args.hash, "phrases": phrases}
    (build / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"✔ voix : {duration:.1f} s · {len(script)} phrases ({hits} groupes depuis le cache) → build/voice.wav, build/timeline.json")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✖ {e}", file=sys.stderr)
        sys.exit(1)
