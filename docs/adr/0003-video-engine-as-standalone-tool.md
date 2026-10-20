# Video engine lives in `tools/video-engine/`, outside the feature-folder layout

We need a local engine that turns three authored files (`script.json`, `scenes.js`, `config.json`) into 1080×1920 animated explainer MP4s for TikTok, Reels and WhatsApp. It is an offline content-production tool: a CLI plus headless Chrome, edge-tts and ffmpeg. It is not part of the Next.js product. Nothing in `src/` imports it, it never ships to users, and it has its own runtime (CommonJS Node, browser scripts, Python for TTS).

`docs/agents/folder-structure.md` puts **all product code** under `src/features/<feature>/`. We deliberately deviate: the engine is a self-contained package at `tools/video-engine/`, with its own `package.json`, its own `node:test` suite and an authoring guide (`AUTHORING.md`). It is excluded from the site's ESLint and Vitest scope. Per-video projects and renders live in the gitignored `content/videos/<slug>/` workspace. A tracked example lives in `tools/video-engine/examples/`.

Trade-offs:
- **Why not inside the app.** Putting it in `src/features/` would drag Node CLI and browser-global code into the Next.js build and lint rules, for something no route uses.
- **Why not a separate repository.** It reuses the site's brand assets (`public/Logo-white-background.svg`, the design tokens from `src/app/globals.css`), and that would make those assets drift.

The cost: `tools/` is a second top-level code location that agents must know about. Revisit this if the engine ever needs to run inside the product, for example a server-side render endpoint.
