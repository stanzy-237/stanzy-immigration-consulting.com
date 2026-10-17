import type { TikTokVideo } from '@/features/landing/data/tiktok-videos';

// Public tikwm proxy returns direct MP4 URLs and TikTok's canonical metadata
// without auth. URLs are time-signed (~24h) so we revalidate every hour.
const TIKWM_URL = 'https://www.tikwm.com/api/';
const REVALIDATE_SECONDS = 3600;
const FETCH_RETRIES = 3;
const RETRY_BACKOFF_MS = 600;

const sleep = (ms: number): Promise<void> =>
  new Promise((r): void => {
    setTimeout(r, ms);
  });

export type TikTokVideoMeta = {
  key: string;
  href: string;
  videoId: string;
  cover: string;
  playUrl: string | null;
  title: string;
  description: string;
  tags: ReadonlyArray<string>;
  views: number | null;
  likes: number | null;
  spinner?: boolean;
};

type TikwmResponse = {
  code?: number;
  msg?: string;
  data?: {
    id?: string;
    title?: string;
    cover?: string;
    origin_cover?: string;
    play?: string;
    wmplay?: string;
    play_count?: number;
    digg_count?: number;
  };
};

function extractTags(title: string): ReadonlyArray<string> {
  const matches = title.match(/#[\p{L}\p{N}_]+/gu);
  return matches ?? [];
}

function stripTags(title: string): string {
  return title.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
}

export async function fetchTikTokMetadata(
  video: TikTokVideo,
): Promise<TikTokVideoMeta> {
  const url = `${TIKWM_URL}?url=${encodeURIComponent(video.href)}`;
  const fallback: TikTokVideoMeta = {
    key: video.key,
    href: video.href,
    videoId: video.href.split('/').pop() ?? '',
    cover: '',
    playUrl: null,
    title: '',
    description: '',
    tags: [],
    views: null,
    likes: null,
    spinner: video.spinner,
  };

  for (let attempt = 0; attempt < FETCH_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        next: { revalidate: REVALIDATE_SECONDS, tags: ['tiktok'] },
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      const payload = (await res.json()) as TikwmResponse;
      const data = payload.data;
      if (!data) {
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }

      const title = data.title ?? '';
      // Direct TikTok CDN URLs often block cross-origin playback; route the
      // bytes through our own /api/tiktok/video proxy so the browser hits
      // the same origin as the page.
      const upstream = data.play ?? data.wmplay ?? null;
      const playUrl = upstream
        ? `/api/tiktok/video?src=${encodeURIComponent(upstream)}`
        : null;
      return {
        ...fallback,
        videoId: data.id ?? fallback.videoId,
        cover: data.cover ?? data.origin_cover ?? fallback.cover,
        playUrl,
        title: stripTags(title),
        description: stripTags(title),
        tags: extractTags(title),
        views: typeof data.play_count === 'number' ? data.play_count : null,
        likes: typeof data.digg_count === 'number' ? data.digg_count : null,
      };
    } catch {
      await sleep(RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  return fallback;
}

export function formatViews(n: number | null): string | null {
  if (n === null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${n}`;
}
