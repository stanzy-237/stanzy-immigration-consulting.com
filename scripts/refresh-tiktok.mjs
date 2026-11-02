#!/usr/bin/env node
// Reads the yt-dlp dump directory, uploads each MP4 + thumbnail to the
// public Cloudflare R2 bucket (#87), and writes a tiktok/manifest.json
// describing the 6 videos. Designed to run after yt-dlp inside
// .github/workflows/refresh-tiktok.yml.
//
// Env:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BUCKET
//                          — the R2 account, its API token and the public bucket
//   R2_PUBLIC_URL          — where that bucket is served (no trailing slash)
//   DUMP_DIR               — where yt-dlp wrote .mp4 + .info.json + .jpg
//                            (defaults to ./tmp/tiktok)

import { AwsClient } from 'aws4fetch';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const DUMP_DIR = process.env.DUMP_DIR ?? 'tmp/tiktok';
const MANIFEST_KEY = 'tiktok/manifest.json';
const MAX_VIDEOS = 6;

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BUCKET', 'R2_PUBLIC_URL'];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Not set: ${missing.join(', ')}`);
  process.exit(1);
}

const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/+$/, '');

/** Writes `body` at `key` in the public bucket (overwriting) and returns its public address. */
async function put(key, body, { contentType, maxAge }) {
  const url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_PUBLIC_BUCKET}/${key}`;
  const response = await r2.fetch(url, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType, 'Cache-Control': `public, max-age=${maxAge}` },
  });
  if (!response.ok) throw new Error(`R2 refused ${key}: ${response.status} ${await response.text()}`);
  return { url: `${PUBLIC_URL}/${key}` };
}

/** @typedef {{ id:string, href:string, title:string, description:string, tags:string[], views:number|null, likes:number|null, videoUrl:string, coverUrl:string, uploadedAt:string, publishedAt:string|null }} ManifestEntry */

async function main() {
  const files = await readdir(DUMP_DIR);
  const infoFiles = files.filter((f) => f.endsWith('.info.json'));
  if (infoFiles.length === 0) {
    console.error(`No .info.json files in ${DUMP_DIR}`);
    process.exit(1);
  }

  // yt-dlp writes files sorted by playlist order; keep that (latest first)
  // and cap at MAX_VIDEOS.
  const items = infoFiles.slice(0, MAX_VIDEOS);
  /** @type {ManifestEntry[]} */
  const entries = [];

  for (const infoName of items) {
    const info = JSON.parse(
      await readFile(join(DUMP_DIR, infoName), 'utf-8'),
    );
    const id = String(info.id);
    const stem = basename(infoName, '.info.json');

    const mp4Path = join(DUMP_DIR, `${stem}.mp4`);
    const thumbExt = ['.jpg', '.jpeg', '.png', '.webp'].find((e) =>
      files.includes(`${stem}${e}`),
    );
    if (!thumbExt) {
      console.warn(`No thumbnail for ${stem}, skipping`);
      continue;
    }
    const thumbPath = join(DUMP_DIR, `${stem}${thumbExt}`);

    const [mp4Buf, thumbBuf] = await Promise.all([
      readFile(mp4Path),
      readFile(thumbPath),
    ]);

    const video = await put(`tiktok/${id}.mp4`, mp4Buf, {
      contentType: 'video/mp4',
      maxAge: 60 * 60 * 24 * 30,
    });
    const cover = await put(`tiktok/${id}${thumbExt}`, thumbBuf, {
      contentType:
        thumbExt === '.webp'
          ? 'image/webp'
          : thumbExt === '.png'
            ? 'image/png'
            : 'image/jpeg',
      maxAge: 60 * 60 * 24 * 30,
    });

    const title = (info.title ?? '').trim();
    const description = (info.description ?? title).trim();
    const rawTags = Array.isArray(info.tags) ? info.tags : [];
    const tags = rawTags.map((t) => (t.startsWith('#') ? t : `#${t}`));

    entries.push({
      id,
      href: info.webpage_url ?? `https://www.tiktok.com/@stanzycanada/video/${id}`,
      title: title.replace(/#[\p{L}\p{N}_]+/gu, '').trim(),
      description: description.replace(/#[\p{L}\p{N}_]+/gu, '').trim(),
      tags,
      views: typeof info.view_count === 'number' ? info.view_count : null,
      likes: typeof info.like_count === 'number' ? info.like_count : null,
      videoUrl: video.url,
      coverUrl: cover.url,
      uploadedAt: new Date().toISOString(),
      publishedAt: info.timestamp
        ? new Date(info.timestamp * 1000).toISOString()
        : null,
    });

    console.log(`uploaded ${id}  (${mp4Buf.length} B)`);
  }

  const manifest = {
    channel: '@stanzycanada',
    refreshedAt: new Date().toISOString(),
    videos: entries,
  };

  const manifestFile = await put(MANIFEST_KEY, JSON.stringify(manifest, null, 2), {
    contentType: 'application/json',
    maxAge: 60 * 60,
  });
  console.log(`manifest -> ${manifestFile.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
