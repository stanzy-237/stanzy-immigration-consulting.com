# Stanzy video engine — authoring guide

How to write a video for the engine. Read this whole file before writing a project. The engine renders a 1080×1920, 30 fps French explainer from three files. `npm run check` enforces every rule marked **(checked)**.

## Commands

Run from `tools/video-engine/`:

| Command | What it does |
|---|---|
| `npm run check -- <slug>` | Validates the project in seconds (runs first in every other command) |
| `npm run voice -- <slug>` | **Audio.** check → Stanzy's voice (Thierry, fr-CA; edge-tts, cached per sentence in `content/videos/_cache/tts/`) → `build/timeline.json` with exact word timings → check again on the real timing → generated music + sound effects + mix (`build/mix.wav`) → preview with sound |
| `npm run video -- <slug>` | **One click, final export.** Everything above (only what's out of date) → frame-by-frame capture (~1 min per 30 s of video) → `build/video.mp4` (H.264 + AAC, verified) + `build/cover.jpg` → copied with `caption.txt` to `~/Downloads/stanzy-videos/<slug>/`. Flags: `--no-open`, `--no-downloads` |
| `npm run preview -- <slug>` | Writes `build/preview.html` (self-contained, with the most complete up-to-date audio) and opens it. Add `--no-open` to skip opening. Append `#t=12.5` to the URL to freeze an exact frame |
| `npm run poses` | Sheet of the 8 mascot poses, for review after mascot changes |
| `npm test` | Engine unit tests (Node + Python) |

Setup (once): `pip3 install --user -r python/requirements.txt`.

A recorded voice is tied to the script text, voice settings and pronunciation. If any of them change, the voice is ignored as **stale** (check warns) until `npm run voice` runs again. Editing only `scenes.js`, `tags` or `poses` keeps the voice.

`<slug>` is a folder in `content/videos/` (gitignored, real videos) or `examples/` (tracked, e.g. `demo`).

## Project layout

```
content/videos/<slug>/
  script.json   voice-over, one entry per sentence
  scenes.js     visuals (HTML + data-* DSL)
  config.json   voice, pronunciation, chapter tags, poses
  build/        generated: timeline.json, voice.wav, mix.wav, preview.html, video.mp4, cover.jpg
  caption.txt   TikTok/WhatsApp caption, written by the author (check warns if missing)
```

`caption.txt`: 2–4 short lines in French ("vous"). It opens with the hook, gives one line of value and ends with the call to action (« Écrivez-nous sur WhatsApp : +237 679 306 015 »). Then 5–8 hashtags, e.g. `#immigrationcanada #entreeexpress #francophones #canada #stanzy`.

## Editorial rules

- **Language and register.** French, always "vous". Spoken sentences, not written prose.
- **Length.** 45–60 s **(checked)**, which is about 120–150 words at 2.6 words/s.
- **Arc.** Hook (first 3 s states the news or the problem) → explanation → what it changes for the viewer → what to do → CTA.
- **Stanzy.** Stanzy is a man ("il", "conseiller"). He is the mascot.
- **Final scene.** It is always logo + URL `www.stanzy-immigration-consulting.com` + a `.cta` button pushing WhatsApp **(checked)**.

## script.json

```json
[
  {"id": "a", "scene": 1, "text": "Le 3 novembre, Entrée express change de visage."},
  {"id": "b", "scene": 1, "text": "Le score CRS est recalculé pour tous les profils."}
]
```

- `id`: a, b, c… in order, no gaps, 26 max **(checked)**.
- `scene`: starts at 1. It either repeats or increases by 1 **(checked)**.
- `text`: 4–12 words **(checked)**. Words are split on regular spaces, and that split drives all timing (subtitles, `@n` references). So never leave punctuation standing alone: write "facteur, jusqu'à", not "facteur : jusqu'à".
- **Numbers and acronyms.** Write them as they should be **read on screen** ("150", "CRS", "l'EIMT"). Each displayed word is converted on its own to what the voice says:
  - **Numbers.** Read in French words: `150` → cent cinquante, `+150`, `−200`, `1,5`, `2×` → deux fois, `10%`, `1er`/`3e`, `~17` → environ dix-sept, `0-1` → zéro à un.
  - **Thousands.** Join them with a **no-break space** (U+00A0), e.g. `55 500`, so the number stays one word and is read "cinquante-cinq mille cinq cents". With a normal space, each group is read separately. Use that for phone numbers: `+237 679 306 015`, where leading zeros are spoken ("zéro quinze").
  - **Acronyms, brands and symbols.** Taken from the global dictionary `engine/pron/fr.json` (IRCC, CRS, EIMT, NCLC, TEF, TCF, CNP, PNP, FÉER, WhatsApp, Stanzy, `≥`, `%`, `→`…). Lookups are case-insensitive and also work after an elision (`l'EIMT`).

## config.json

```json
{
  "title": "Entrée express change le 3 novembre",
  "voice": {"name": "fr-CA-ThierryNeural", "rate": "+6%"},
  "pron": {"Stanzy": "Stan-zi"},
  "tags": {"1": ["Le changement"], "4": ["À vous !", "#cc1627", "#ffffff"]},
  "poses": {"a": "wave", "b": "point"},
  "music": {"mood": "upbeat", "volume": 0.22},
  "cover": "a@4"
}
```

- `music`: the soundtrack is **generated for each video** at the video's exact length. There are no files to download. Pick the mood from the story:
  - `upbeat`: good news, opportunities (104 bpm, full groove).
  - `calm`: explanations, step-by-step guides (84 bpm, soft lo-fi).
  - `serious`: deadlines, refusals, warnings (92 bpm, minor feel).

  `volume` (default 0.22) is the music level under the voice. `bpm` optionally overrides the mood's tempo. The music ducks automatically while Stanzy speaks. Every entrance gets a matching sound effect: `pop` → blip, `drop` → whoosh, `up`/`left` → swoosh, `stamp` → thud, `grow` → rise, `.cta` → chime, `data-cls …:on` → tick.
- `cover`: time reference of the cover frame (`build/cover.jpg`). It defaults to just before the end of scene 1. Choose a moment where the hook headline is fully on screen.

- `tags`: chapter title per scene, shown top-left (y 250) and entering with the scene's first sentence. The format is `[text, background, text colour]`, defaulting to navy/white.
- `poses`: one mascot pose per sentence, from `idle wave point head shrug thumbs think both` **(checked)**. Unlisted sentences use `idle`. Use `point` when the sentence refers to something on screen, since the left arm points at the content.
- `pron`: per-video overrides as `{"Mot": "comment le dire"}`. One word per key, no spaces **(checked)**. Recurring terms belong in `engine/pron/fr.json` instead. After the first `npm run voice`, read the `♪` lines it prints (the spoken text) and fix anything that sounds wrong.
- `signature`: optional, 2 lines. It defaults to the URL + phone + @stanzycanada anti-plagiarism line.
- `draft: true`: downgrades the duration check to a warning. Only for demos and tests.

## scenes.js

```js
document.getElementById('scenes').innerHTML = `
<div class="scene" data-scene="1">
  <div class="card" data-in="a@2" data-a="drop" data-r="-3"
       style="left:70px;top:360px;width:500px;height:300px">…</div>
</div>`;
```

- **Scenes.** One `<div class="scene" data-scene="N">` per scene in the script **(checked)**. No `${…}` interpolation **(checked)**.
- **Element count.** 2–6 **top-level animated elements** per scene **(checked)**. Elements with `data-in` nested inside another animated element are free.
- **Position.** Every top-level animated element sets `left`, `top`, `width` and `height` in px **(checked)**. It never sets `transform`; use `data-r` and `data-kf` instead **(checked)**.
- **No external assets.** No `<img>` and no `http` URLs. Use CSS, inline SVG or emoji only **(checked)**.

### Zones (1080×1920 canvas, TikTok-safe)

| Zone | Area |
|---|---|
| Chapter tag (automatic) | x 70, y 250–320 |
| **Content** | **x 60–900, y 330–1280 (checked)** |
| Mascot (automatic) | x 700–920, y 880–1265 (overlap → warning) |
| Subtitles (automatic) | y 1300–1400 |
| Signature (automatic) | y 1730+, may be hidden by the TikTok caption |

Keep content above y 880 on the right half, or under x 680 lower down, so it doesn't collide with the mascot.

### Timing: `data-in`, `data-out`

| Value | Moment |
|---|---|
| `b` | start of sentence b |
| `b@3` | start of the **4th** word of b (index from 0) |
| `b$` | end of sentence b |
| `b@3+0.2` / `b$-0.3` | offset in seconds |

An element appears on the word it illustrates. Its `data-in` must reference a sentence of **its own scene** **(checked)**. It leaves at the end of its scene, or earlier with `data-out`.

### Animation attributes

| Attribute | Effect |
|---|---|
| `data-a` | Entrance: `pop` (default) · `drop` · `up` · `left` · `stamp` · `fade` · `grow` (left→right). Unknown values fail **(checked)** |
| `data-r="-3"` | Resting rotation in degrees |
| `data-kf='[["c@2",{"x":-300,"y":120,"r":10,"s":0.5,"o":0}]]'` | Moves (0.6 s each) relative to the resting position. Use single quotes around the JSON |
| `data-wig="2"` | Continuous wobble, in degrees of amplitude |
| `data-pulse` | Gentle pulse after entrance (good on `.cta`) |
| `data-count="435"` | Counts 0 → 435 after entrance. It updates a child `.n` if present, otherwise the element's text. `data-pre="+"` and `data-suf=" pts"` add a prefix/suffix |
| `data-draw` | Strokes of the element's SVG shapes draw themselves |
| `data-cls="b@2:on;c:off"` | Adds a class from a moment. Allowed on **any** element, including non-animated children (e.g. ticking checklist items) |

## Components

| Class | Use | Inner markup |
|---|---|---|
| `card` / `card dark` / `card rouge` | Panel | `.t` title (serif), `p` text |
| `chip` / `chip navy` | Pill with red dot | text |
| `badge` / `badge navy` | Solid red/navy label | text |
| `lbl` | Small navy label | text |
| `stamp` | Rubber stamp, uppercase red (pair with `data-a="stamp"` and `data-r`) | short text |
| `hand` / `hand rouge` | Handwritten note (Caveat) | text |
| `big` | Serif headline; wrap the key words in `.acc` for red | text |
| `stat` / `stat rouge` | Huge number (pair with `data-count`) | `<span class="n">0</span><small>label</small>` |
| `num` | Red numbered circle | digit |
| `mini-table` | 2–4 row table (inside a `card`); last column red serif; `tr.hot` highlights | `<table class="mini-table"><tr><th>…` |
| `timeline` | Dated steps; `.step.on` fills the dot | `<div class="step"><div><div class="d">3 nov.</div><div class="e">…</div></div></div>` |
| `doc` / `doc paper` | Passport/permit/letter | `svg.leaf`, `.k` kicker, `.t` title, `.lines` with `<span>` |
| `checklist` | Ticked list; `li.on` is checked (use `data-cls` on each `li`) | `<ul class="checklist"><li>…</li></ul>` |
| `cta` | Red call-to-action button (final scene) | text |
| `url` | Bold site URL | `www.stanzy-immigration-consulting.com` |
| `logo` | Stanzy logo, injected automatically (keep the 4:3 ratio, e.g. 300×226) | empty |

Copy patterns from `examples/demo/scenes.js`, which uses every component.

## Workflow for a new video

The user gives a story or a source (an IRCC page, draw data). The author then:

1. Creates `content/videos/<slug>/` with the three files and `caption.txt`.
2. Runs `npm run check -- <slug>` and fixes every ✖, iterating on the silent preview if useful.
3. Runs `npm run voice -- <slug>` and reads the spoken text (`♪` lines) for pronunciation slips.
4. Checks key frames with `preview.html#t=…` (headless Chrome screenshots) for layout and sync.
5. Runs `npm run video -- <slug>` and delivers the folder in `~/Downloads/stanzy-videos/<slug>/` (MP4, cover, caption).

## Dialogue extras (episode 4)

- **Cast moves.** `cast.<id>.moves: [["o-0.6", {"x": 150, "s": 0.74}], ["r-0.9", {"x": 290, "s": 1}]]` eases the character (0.9 s) to an absolute centre `x` (60–1020) and scale `s` (0.3–1.5) **(checked)**. Use it to clear the middle of the screen, then move everyone back.
- **Wide scene.** `<div class="scene" data-scene="7" data-zone="wide">` lets content run down to y 1335 (just above the subtitles) once the cast has moved aside **(checked)**.
- **Music dip.** `music.dip: [["o-0.6", "q$+1.2", 0.5]]` lowers the music to the given gain over a range, with soft 0.4 s ramps (`mute` is the hard cut) **(checked)**.
- **Poses.** `cross` (arms crossed) and `pointr` (points to the viewer's right: use it when the character is left of the content).
- **Sound effects.** `boum` (deep impact), `buzzer` (error), `scan`, `marker` (highlighter), `question` (two rising notes), `tap`, `typing`, `loading`. A `data-cls` whose class is `on` ticks; use another class name (e.g. `lit`) for silent state changes.
- **Components.** `mail` (`.head .av .from`, `.subj`, `.lines`), `quote`, `hl` (+ `lit` = highlighted), `blur` (hide a real number), `loupe`, `kv` (key/value row), `phone` (`.screen > .notch, .rec, .scr`; inside: `.url-bar`, `.site`, `.flag`, `.opt` (+ `tap`), `.h`, `.field`, `.btn` (+ `tap`), `.spin`, `.zoom`), `pill … fit`.
