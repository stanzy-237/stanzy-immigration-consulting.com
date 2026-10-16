#!/usr/bin/env node
// Reads the yt-dlp dump directory, uploads each MP4 + thumbnail to Vercel
// Blob, and writes a tiktok/manifest.json describing the 6 videos. Designed
// to run after yt-dlp inside .github/workflows/refresh-tiktok.yml.
//
// Env:
//   BLOB_READ_WRITE_TOKEN  — the Vercel Blob store token
//   DUMP_DIR               — where yt-dlp wrote .mp4 + .info.json + .jpg
//                            (defaults to ./tmp/tiktok)

import { put } from '@vercel/blob';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const DUMP_DIR = process.env.DUMP_DIR ?? 'tmp/tiktok';
const MANIFEST_KEY = 'tiktok/manifest.json';
const MAX_VIDEOS = 6;

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN not set');
  process.exit(1);
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

    const videoBlob = await put(`tiktok/${id}.mp4`, mp4Buf, {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    const coverBlob = await put(`tiktok/${id}${thumbExt}`, thumbBuf, {
      access: 'public',
      contentType:
        thumbExt === '.webp'
          ? 'image/webp'
          : thumbExt === '.png'
            ? 'image/png'
            : 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
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
      videoUrl: videoBlob.url,
      coverUrl: coverBlob.url,
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

  const manifestBlob = await put(
    MANIFEST_KEY,
    JSON.stringify(manifest, null, 2),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60,
    },
  );
  console.log(`manifest -> ${manifestBlob.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
