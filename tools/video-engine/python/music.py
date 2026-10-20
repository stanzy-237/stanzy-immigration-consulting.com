"""Music + sound effects + mix: build/mix.wav (48 kHz stereo) from the voice and the timeline.

The soundtrack is composed per video: a mood picks tempo, key, progression and
instrumentation; the track lasts exactly the video's duration. On-screen events get
matching sound effects. Music ducks under the voice (deeper under chosen speakers)
and can be muted over ranges. Deterministic.

Usage: python3 music.py --project DIR --events build/events.json --hash HASH
"""
import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

SR = 48000
TAU = 2 * np.pi
SFX_NAMES = list(json.loads((Path(__file__).resolve().parent.parent / "engine" / "sfx.json").read_text(encoding="utf-8")))

MOODS = {
    # chords as MIDI notes (root first); one chord per bar
    "upbeat": {"bpm": 104, "prog": [[48, 55, 64, 67], [43, 55, 62, 71], [45, 57, 60, 64], [41, 57, 60, 65]],
               "drums": "full", "arp": 8},
    "calm": {"bpm": 84, "prog": [[41, 57, 60, 64], [40, 55, 59, 62], [38, 53, 57, 60], [36, 55, 59, 64]],
             "drums": "soft", "arp": 4},
    "serious": {"bpm": 92, "prog": [[45, 57, 60, 64], [41, 57, 60, 65], [36, 55, 60, 64], [43, 55, 59, 62]],
                "drums": "soft", "arp": 8},
    "afro": {"bpm": 108, "prog": [[48, 60, 64, 67], [41, 60, 65, 69], [43, 59, 62, 67], [41, 60, 65, 69]],
             "drums": "afro", "arp": 0},
}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def env_ad(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def tone(freq, dur, harmonics=((1, 1.0),), detune_cents=0.0):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for mult, amp in harmonics:
        f = freq * mult * 2 ** (detune_cents / 1200)
        out += amp * np.sin(TAU * f * t)
    return out


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s = sig[max(0, -i):]
    i = max(0, i)
    n = min(len(s), len(buf) - i)
    buf[i:i + n] += gain * s[:n]


def lowpass(x, cutoff):
    a = np.exp(-TAU * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def pluck(freq, dur, rng, brightness=0.5, decay=0.996):
    """Karplus-Strong plucked string, block-vectorised over the delay line."""
    n = int(dur * SR)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    buf = brightness * buf + (1 - brightness) * np.convolve(buf, [0.5, 0.5], mode="same")
    out = np.empty(n)
    pos = 0
    while pos < n:
        m = min(period, n - pos)
        out[pos:pos + m] = buf[:m]
        nxt = decay * 0.5 * (buf + np.roll(buf, -1))
        buf = nxt
        pos += m
    return out * env_ad(n, 0.002, dur * 0.6)


# ---------- music ----------
def compose(duration, mood_name, bpm=None, seed=7):
    mood = MOODS.get(mood_name, MOODS["upbeat"])
    bpm = bpm or mood["bpm"]
    beat = 60.0 / bpm
    bar = 4 * beat
    rng = np.random.default_rng(seed)
    n = int(duration * SR) + SR
    pad, bass, keys, drums = (np.zeros(n) for _ in range(4))

    bars = int(np.ceil(duration / bar)) + 1
    for b in range(bars):
        t0 = b * bar
        chord = mood["prog"][b % len(mood["prog"])]
        root, tones = chord[0], chord[1:]
        for m in tones:
            for cents in (-6, 6):
                sig = tone(hz(m), bar + 0.6, ((1, 1.0), (2, 0.22), (3, 0.06)), cents)
                e = np.minimum(1, np.arange(len(sig)) / (0.35 * SR)) * np.minimum(1, (len(sig) - np.arange(len(sig))) / (0.6 * SR))
                place(pad, sig * e, t0, 0.03 if mood["drums"] == "afro" else 0.045)

        if mood["drums"] == "afro":
            # makossa-style bass: root / octave / fifth on syncopated 8ths
            for off, interval, g in ((0, 0, 1.0), (0.75, 12, 0.6), (1.5, 7, 0.8), (2.5, 0, 0.9), (3.0, 12, 0.6), (3.5, 7, 0.7)):
                sig = tone(hz(root - 12 + interval), 0.5, ((1, 1.0), (2, 0.4), (3, 0.1)))
                place(bass, sig * env_ad(len(sig), 0.006, 0.18), t0 + off * beat, 0.2 * g)
        else:
            for off, g in ((0, 1.0), (2.5 * beat, 0.7)):
                sig = tone(hz(root - 12), 0.9, ((1, 1.0), (2, 0.35)))
                place(bass, sig * env_ad(len(sig), 0.008, 0.35), t0 + off, 0.22 * g)
        if b == 0:
            continue  # intro bar: pad + bass only

        if mood["drums"] == "afro":
            # highlife guitar: 16th-note picking over the chord, accents on the offbeats
            pattern = [2, 1, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 0, 1, 2, 1]
            for s, idx in enumerate(pattern):
                if s % 4 == 3 and s != 15:
                    continue
                at = t0 + s * beat / 4
                vel = 1.0 if s % 2 else 0.6
                note = tones[idx] + 12
                place(keys, pluck(hz(note), 0.45, rng, 0.6), at, 0.05 * vel)
        else:
            steps = mood["arp"]
            pattern = [tones[i % len(tones)] + 12 for i in (0, 1, 2, 1, 0, 2, 1, 2)]
            for s in range(steps):
                at = t0 + s * (bar / steps)
                vel = 0.75 + 0.25 * ((s * 37) % 5) / 4
                sig = tone(hz(pattern[s % len(pattern)]), 0.6, ((1, 1.0), (2, 0.25), (4, 0.05)))
                place(keys, sig * env_ad(len(sig), 0.004, 0.22), at, 0.06 * vel)

        for k in range(4):
            at = t0 + k * beat
            if mood["drums"] in ("full", "afro") and k in (0, 2):
                t = np.arange(int(0.3 * SR)) / SR
                f = 45 + 80 * np.exp(-t / 0.04)
                kick = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.16)
                place(drums, kick, at, 0.3)
            if k in (1, 3):
                noise = rng.standard_normal(int(0.18 * SR))
                clap = highpass(noise, 1200) * env_ad(len(noise), 0.002, 0.05)
                place(drums, clap, at, 0.07 if mood["drums"] == "full" else 0.045)
            for h in range(4 if mood["drums"] == "afro" else 2):
                step = beat / 4 if mood["drums"] == "afro" else beat * 0.54
                noise = rng.standard_normal(int(0.05 * SR))
                shk = highpass(noise, 6000) * env_ad(len(noise), 0.001, 0.012)
                place(drums, shk, at + h * step, 0.022 if h % 2 else 0.03)
            if mood["drums"] == "afro":
                for off, f0 in ((0.5, 330), (0.75, 220)) if k % 2 else ((0.75, 250),):
                    t = np.arange(int(0.2 * SR)) / SR
                    conga = np.sin(TAU * f0 * t * (1 + 0.15 * np.exp(-t / 0.02))) * np.exp(-t / 0.07)
                    place(drums, conga, at + off * beat, 0.09)

    mix = pad + bass + keys + drums
    mix = np.tanh(mix * 1.4) / np.tanh(1.4)
    mix = mix[: int(duration * SR)]
    fade_in = np.minimum(1, np.arange(len(mix)) / (1.2 * SR))
    fade_out = np.clip((duration - np.arange(len(mix)) / SR) / 3.0, 0, 1)
    mix *= fade_in * fade_out
    return mix / (np.max(np.abs(mix)) + 1e-9)


# ---------- sound effects ----------
def _bell(freq, dur, decay):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(TAU * freq * t) + 0.5 * np.sin(TAU * freq * 2.76 * t) * np.exp(-t / (decay * 0.4))
            + 0.25 * np.sin(TAU * freq * 5.4 * t) * np.exp(-t / (decay * 0.2))) * np.exp(-t / decay)


def _brass(freq, dur, vib=0.0):
    t = np.arange(int(dur * SR)) / SR
    f = freq * (1 + vib * np.sin(TAU * 5.5 * t))
    ph = TAU * np.cumsum(f) / SR
    sig = sum(np.sin(k * ph) / k for k in range(1, 9))
    return sig * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.05)


def sfx(kind, rng):
    if kind == "pop":
        t = np.arange(int(0.14 * SR)) / SR
        f = 700 + 900 * (1 - np.exp(-t / 0.03))
        return np.sin(TAU * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.04) * 0.9
    if kind in ("whoosh", "swoosh"):
        n = int(0.32 * SR)
        shaped = lowpass(highpass(rng.standard_normal(n), 500), 3500)
        return shaped * np.sin(np.linspace(0, np.pi, n)) ** 2 * (1.6 if kind == "whoosh" else 1.1)
    if kind == "stamp":
        t = np.arange(int(0.3 * SR)) / SR
        thud = np.sin(TAU * np.cumsum(70 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.09)
        return thud + highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.008) * 0.5
    if kind == "tick":
        t = np.arange(int(0.06 * SR)) / SR
        return np.sin(TAU * 2200 * t) * np.exp(-t / 0.01) * 0.8
    if kind == "rise":
        t = np.arange(int(0.35 * SR)) / SR
        return np.sin(TAU * np.cumsum(400 + 800 * t / t[-1]) / SR) * np.sin(np.pi * t / t[-1]) * 0.35
    if kind == "chime":
        t = np.arange(int(1.4 * SR)) / SR
        return (np.sin(TAU * 1046.5 * t) + 0.6 * np.sin(TAU * 1568 * t) + 0.3 * np.sin(TAU * 2093 * t)) * np.exp(-t / 0.45) * 0.5
    if kind == "dun":
        out = np.zeros(int(2.0 * SR))
        for at, f, d in ((0, hz(38), 0.22), (0.3, hz(38), 0.22), (0.6, hz(37), 1.3)):
            place(out, _brass(f, d, 0.004 if d > 1 else 0) + 0.6 * _brass(f * 1.5, d), at, 0.5)
        return lowpass(out, 1800)
    if kind == "notif":
        out = np.zeros(int(0.35 * SR))
        for at, f in ((0, 1318.5), (0.11, 1760)):
            place(out, _bell(f, 0.2, 0.05), at)
        return out
    if kind == "doorbell":
        out = np.zeros(int(1.8 * SR))
        place(out, _bell(659.3, 1.0, 0.45), 0)
        place(out, _bell(523.3, 1.3, 0.6), 0.45)
        return out * 0.7
    if kind == "jingle":
        out = np.zeros(int(0.9 * SR))
        place(out, _bell(784, 0.5, 0.18) + 0.4 * tone(784 * 4, 0.5) * env_ad(int(0.5 * SR), 0.001, 0.03), 0)
        place(out, _bell(1046.5, 0.7, 0.3), 0.16)
        return out * 0.8
    if kind == "ding":
        return _bell(1568, 0.8, 0.3) * 0.7
    if kind == "clicks":
        out = np.zeros(int(0.9 * SR))
        at = 0.0
        for i in range(14):
            place(out, sfx("tick", rng)[: int(0.03 * SR)], at, 0.6)
            at += 0.085 * (0.93 ** i)
        return out
    if kind == "scratch":
        n = int(0.45 * SR)
        t = np.arange(n) / SR
        carrier = np.sin(TAU * np.cumsum(300 + 900 * np.abs(np.sin(TAU * 4.5 * t))) / SR)
        return (carrier * 0.6 + highpass(rng.standard_normal(n), 1500) * 0.5) * np.sin(np.pi * t / t[-1]) ** 0.5
    if kind == "fanfare":
        out = np.zeros(int(1.6 * SR))
        for i, m in enumerate((72, 76, 79)):
            place(out, _brass(hz(m), 0.14), i * 0.13, 0.35)
        for m in (72, 76, 79, 84):
            place(out, _brass(hz(m), 0.9, 0.006), 0.42, 0.22)
        return lowpass(out, 4000)
    if kind == "kaching":
        out = np.zeros(int(0.9 * SR))
        place(out, highpass(rng.standard_normal(int(0.05 * SR)), 3000) * np.exp(-np.arange(int(0.05 * SR)) / SR / 0.01), 0, 0.6)
        place(out, _bell(2500, 0.8, 0.25) + 0.7 * _bell(3760, 0.8, 0.2), 0.08, 0.5)
        return out
    if kind == "rewind":
        n = int(0.6 * SR)
        t = np.arange(n) / SR
        f = 1800 * np.exp(-t / 0.25) + 250
        return np.sin(TAU * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(TAU * 28 * t)) * np.sin(np.pi * t / t[-1]) * 0.6
    if kind == "sparkle":
        out = np.zeros(int(0.8 * SR))
        for i, f in enumerate((2637, 3136, 3951, 3520, 4186)):
            place(out, _bell(f, 0.3, 0.08), i * 0.07, 0.4)
        return out
    if kind == "crumple":
        out = np.zeros(int(0.7 * SR))
        for i in range(18):
            burst = highpass(rng.standard_normal(int(0.02 * SR)), 1000) * np.hanning(int(0.02 * SR))
            place(out, burst, rng.uniform(0, 0.6), 0.5)
        return out
    if kind == "alarm":
        out = np.zeros(int(0.7 * SR))
        for at in (0, 0.3):
            t = np.arange(int(0.18 * SR)) / SR
            place(out, np.sign(np.sin(TAU * 1046 * t)) * 0.4, at)
        return lowpass(out, 3000)
    if kind == "tictac":
        out = np.zeros(int(1.6 * SR))
        for i in range(6):
            t = np.arange(int(0.03 * SR)) / SR
            place(out, np.sin(TAU * (1800 if i % 2 else 1300) * t) * np.exp(-t / 0.006), i * 0.26, 0.7)
        return out
    if kind == "gears":
        out = np.zeros(int(1.0 * SR))
        for i in range(16):
            t = np.arange(int(0.025 * SR)) / SR
            place(out, highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.004), i * 0.06, 0.5)
        t = np.arange(len(out)) / SR
        return out + 0.15 * np.sin(TAU * 110 * t) * np.sin(np.pi * t / t[-1])
    if kind == "trombone":
        out = np.zeros(int(2.3 * SR))
        for i, m in enumerate((58, 57, 56)):
            place(out, _brass(hz(m), 0.38) * np.sin(np.linspace(0, np.pi, int(0.38 * SR))), i * 0.42, 0.4)
        place(out, _brass(hz(55), 1.0, 0.012) * np.exp(-np.arange(int(1.0 * SR)) / SR / 0.6), 1.26, 0.4)
        return lowpass(out, 1500)
    return np.zeros(1)


ANIM_SFX = {"pop": "pop", "drop": "whoosh", "up": "swoosh", "left": "swoosh", "stamp": "stamp", "grow": "rise", "fade": None}
SFX_GAIN = {"pop": 0.16, "whoosh": 0.05, "swoosh": 0.04, "stamp": 0.3, "tick": 0.12, "rise": 0.08, "chime": 0.16,
            "dun": 0.4, "notif": 0.22, "doorbell": 0.35, "jingle": 0.25, "ding": 0.2, "clicks": 0.18, "scratch": 0.35,
            "fanfare": 0.3, "kaching": 0.22, "rewind": 0.3, "sparkle": 0.18, "crumple": 0.3, "alarm": 0.18,
            "tictac": 0.25, "gears": 0.3, "trombone": 0.35}
EXPLICIT_GAP = 0.02  # explicit cues may stack; automatic entrance sounds are thinned to 1 per 90 ms


def effects(duration, events):
    buf = np.zeros(int(duration * SR))
    rng = np.random.default_rng(11)
    last = -1.0
    for ev in sorted(events, key=lambda e: e["t"]):
        explicit = bool(ev.get("sfx"))
        kind = ev.get("sfx") or ANIM_SFX.get(ev.get("a"))
        if not kind or ev["t"] - last < (EXPLICIT_GAP if explicit else 0.09):
            continue
        last = ev["t"]
        at = ev["t"] + (0.22 if kind == "stamp" else -0.08 if kind in ("whoosh", "swoosh") else 0.0)
        place(buf, sfx(kind, rng), at, SFX_GAIN[kind])
    return buf


# ---------- mix ----------
def load_voice(path):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    raw = subprocess.run([ffmpeg, "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def duck_envelope(duration, phrases, depth=0.32, ramp=0.18, deep=(), deep_depth=0.2):
    t = np.arange(int(duration * SR)) / SR
    g = np.ones_like(t)
    for p in phrases:
        s, e = p["start"] - 0.12, p["end"] + 0.2
        d = deep_depth if p.get("who") in deep else depth
        inside = np.clip(np.minimum((t - s) / ramp + 1, (e - t) / ramp + 1), 0, 1)
        g = np.minimum(g, 1 - (1 - d) * inside)
    return g


def mute_envelope(duration, ranges, ramp=0.04):
    t = np.arange(int(duration * SR)) / SR
    g = np.ones_like(t)
    for r in ranges:
        inside = np.clip(np.minimum((t - r["from"]) / ramp, (r["to"] - t) / ramp), 0, 1)
        g = np.minimum(g, 1 - inside)
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--events", required=True)
    ap.add_argument("--hash", required=True)
    args = ap.parse_args()
    build = Path(args.project) / "build"
    timeline = json.loads((build / "timeline.json").read_text(encoding="utf-8"))
    config = json.loads((Path(args.project) / "config.json").read_text(encoding="utf-8"))
    plan = json.loads(Path(args.events).read_text(encoding="utf-8"))
    events, mute = plan["events"], plan.get("mute", [])
    music_cfg = config.get("music") or {}
    mood = music_cfg.get("mood", "upbeat")
    volume = float(music_cfg.get("volume", 0.22))
    duration = timeline["duration"]

    voice = load_voice(build / "voice.wav")
    n = int(duration * SR)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    voice *= 0.89 / (np.max(np.abs(voice)) + 1e-9)

    music = compose(duration, mood, music_cfg.get("bpm"))
    music = music[:n] * volume * duck_envelope(duration, timeline["phrases"], deep=tuple(music_cfg.get("duckDeep", [])))
    music *= mute_envelope(duration, mute)
    fx = effects(duration, events)

    width = 0.12
    left = voice + music * (1 + width) + fx
    right = voice + music * (1 - width) + fx
    stereo = np.stack([left, right], axis=1)
    peak = np.max(np.abs(stereo))
    if peak > 0.98:
        stereo *= 0.98 / peak
    pcm = (stereo * 32767).astype("<i2")
    with wave.open(str(build / "mix.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    (build / "mix.json").write_text(json.dumps({"hash": args.hash, "mood": mood, "duration": duration}), encoding="utf-8")
    print(f"  ✔ musique « {mood} » + {len(events)} effets + voix → build/mix.wav ({duration:.1f} s)", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✖ {e}", file=sys.stderr)
        sys.exit(1)
