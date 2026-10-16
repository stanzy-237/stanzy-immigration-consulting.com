export type TikTokVideo = {
  key: string;
  href: string;
  thumbnail: string;
  spinner?: boolean;
};

// Six videos from @stanzycanada supplied by the owner. Titles, descriptions,
// tags, views and the actual MP4 URL are hydrated at request time by the
// server helper in /features/landing/server/fetch-tiktok-metadata.ts; the
// thumbnail here is only the hard fallback when that fetch fails.
export const TIKTOK_VIDEOS: ReadonlyArray<TikTokVideo> = [
  {
    key: 'v1',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686981403195510047',
    thumbnail:
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=700&q=85',
  },
  {
    key: 'v2',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686379908460727582',
    thumbnail:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&q=85',
  },
  {
    key: 'v3',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686190839403400478',
    thumbnail:
      'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=700&q=85',
    spinner: true,
  },
  {
    key: 'v4',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681947634025696543',
    thumbnail:
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=700&q=85',
  },
  {
    key: 'v5',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681194653969943839',
    thumbnail:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=85',
  },
  {
    key: 'v6',
    href: 'https://www.tiktok.com/@stanzycanada/video/7679181359193034015',
    thumbnail:
      'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=700&q=85',
  },
] as const;
