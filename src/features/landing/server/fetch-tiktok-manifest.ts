import type { TikTokVideoMeta } from './fetch-tiktok-metadata';

export type ManifestEntry = {
  id: string;
  href: string;
  title: string;
  description: string;
  tags: ReadonlyArray<string>;
  views: number | null;
  likes: number | null;
  videoUrl: string;
  coverUrl: string;
  uploadedAt: string;
  publishedAt: string | null;
};

export type TikTokManifest = {
  channel: string;
  refreshedAt: string;
  videos: ReadonlyArray<ManifestEntry>;
};

// The public R2 bucket (#87) serves the JSON the weekly job wrote at
// `tiktok/manifest.json`, from NEXT_PUBLIC_R2_PUBLIC_URL (the bucket's
// custom domain or r2.dev address). Falls back to the public tikwm pipeline
// when the manifest can't be read.
const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
const MANIFEST_PATH = 'tiktok/manifest.json';
const REVALIDATE_SECONDS = 3600;

export async function fetchTikTokManifest(): Promise<TikTokManifest | null> {
  if (!PUBLIC_BASE_URL) return null;
  const url = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${MANIFEST_PATH}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ['tiktok'] },
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as TikTokManifest;
  } catch {
    return null;
  }
}

export function entryToMeta(entry: ManifestEntry): TikTokVideoMeta {
  return {
    key: entry.id,
    href: entry.href,
    videoId: entry.id,
    cover: entry.coverUrl,
    playUrl: entry.videoUrl,
    title: entry.title,
    description: entry.description,
    tags: entry.tags,
    views: entry.views,
    likes: entry.likes,
  };
}
