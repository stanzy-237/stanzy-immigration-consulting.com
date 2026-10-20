# Content production moved to a separate repository

Status: accepted (2026-10-20). Supersedes [ADR 0003](0003-video-engine-as-standalone-tool.md).

The video engine (`tools/video-engine/`) and the content workspace (`content/`) now live in their own repository: `../stanzy_content_studio`. The engine's git history was carried over with `git subtree`. This repo is the website only.

Why: the owner wants content creation isolated from the product. Nothing in `src/` ever used either of them.

Trade-off: ADR 0003 kept the engine here so it could reuse `public/Logo-white-background.svg` and the tokens in `src/app/globals.css`. The studio now keeps copies in its `brand/` folder. **When the logo or palette changes here, update `stanzy_content_studio/brand/` and its `video-engine/engine/styles.css` too.**
