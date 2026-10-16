# TikTok carousel pipeline

The landing-page TikTok row renders the six latest `@stanzycanada` clips as
inline, muted-autoplay videos. The MP4s are vendored into our own Vercel
Blob store by a weekly GitHub Actions job, so the browser never fights
TikTok's CDN at request time.

## Flow

1. **Weekly cron** (`.github/workflows/refresh-tiktok.yml`, Sundays 03:00 UTC)
   installs `yt-dlp` and pulls the 6 most-recent videos + thumbnails +
   metadata from `https://www.tiktok.com/@stanzycanada`.
2. **Upload script** (`scripts/refresh-tiktok.mjs`) copies each MP4 and
   thumbnail into Vercel Blob under `tiktok/<id>.mp4` / `tiktok/<id>.jpg`,
   then writes a `tiktok/manifest.json` describing all six.
3. **At request time** the landing-page RSC
   (`src/features/landing/components/tiktok-row.tsx`) reads
   `tiktok/manifest.json` via `fetchTikTokManifest()` (Next `fetch` cache,
   revalidate 3600s) and hands the videos to the client carousel.
4. **Fallback**: if the manifest can't be loaded (first deploy, Blob down),
   the RSC falls back to the live `tikwm.com` proxy per-video so the row
   still renders.

## One-time setup

1. **Create a Vercel Blob store** — in the Vercel dashboard, pick the
   project, go to **Storage → Create → Blob**, name it anything, then open
   the store and copy its **Public base URL** (e.g.
   `https://xxxxxxxxxxxxxxxx.public.blob.vercel-storage.com`) and its
   **Read/Write Token** (`vercel_blob_rw_...`).
2. **Add env vars**:
   - In Vercel → the project → Settings → Environment Variables, add
     `NEXT_PUBLIC_BLOB_BASE_URL = <the public base URL>` for all environments.
   - In the GitHub repo → Settings → Secrets and variables → Actions,
     add `BLOB_READ_WRITE_TOKEN = <the token>`.
3. **Run the workflow once** from GitHub → Actions → *Refresh TikTok
   carousel* → *Run workflow* so the first manifest exists. After that it
   runs weekly on its own.

## Updating the channel

The channel URL is pinned to `https://www.tiktok.com/@stanzycanada` in two
places:

- `.github/workflows/refresh-tiktok.yml` → `env.TIKTOK_CHANNEL`
- `src/features/landing/data/tiktok-videos.ts` (the fallback list of six
  video URLs, only used until the first manifest is populated)

If the channel ever changes, update both.

## Why not the official TikTok Display API?

Display API requires business approval and only hands back an `embed_link`
(an iframe with TikTok chrome and no sound control), so it can't satisfy
the design's inline-looking, sound-on-active requirement. See the
`/wayfinder` analysis in commit history for the full comparison.
