export type TikTokVideo = {
  key: string;
  href: string;
  spinner?: boolean;
};

// Six videos from @stanzycanada. Covers, titles, tags, views and the MP4
// URL are hydrated at request time from the Vercel Blob manifest written
// by the weekly refresh-tiktok workflow (see docs/tiktok-pipeline.md).
export const TIKTOK_VIDEOS: ReadonlyArray<TikTokVideo> = [
  {
    key: 'v1',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686981403195510047',
  },
  {
    key: 'v2',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686379908460727582',
  },
  {
    key: 'v3',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686190839403400478',
    spinner: true,
  },
  {
    key: 'v4',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681947634025696543',
  },
  {
    key: 'v5',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681194653969943839',
  },
  {
    key: 'v6',
    href: 'https://www.tiktok.com/@stanzycanada/video/7679181359193034015',
  },
] as const;
