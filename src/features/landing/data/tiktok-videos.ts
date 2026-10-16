export type TikTokVideo = {
  key: string;
  href: string;
  titleKey: string;
  tagsKey: string;
  thumbnail: string;
  spinner?: boolean;
};

// Six latest videos from @stanzycanada supplied by the owner. Titles and
// tags live in the Home.TikTok.Videos i18n namespace; most are TODO
// placeholders waiting for the real captions. Thumbnails are the
// Unsplash placeholders the MagicPath design shipped with — swap them
// for actual TikTok still frames once we have a scraper or admin feed.
export const TIKTOK_VIDEOS: ReadonlyArray<TikTokVideo> = [
  {
    key: 'v1',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686981403195510047',
    titleKey: 'v1Title',
    tagsKey: 'v1Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=700&q=85',
  },
  {
    key: 'v2',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686379908460727582',
    titleKey: 'v2Title',
    tagsKey: 'v2Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&q=85',
  },
  {
    key: 'v3',
    href: 'https://www.tiktok.com/@stanzycanada/video/7686190839403400478',
    titleKey: 'v3Title',
    tagsKey: 'v3Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=700&q=85',
    spinner: true,
  },
  {
    key: 'v4',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681947634025696543',
    titleKey: 'v4Title',
    tagsKey: 'v4Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=700&q=85',
  },
  {
    key: 'v5',
    href: 'https://www.tiktok.com/@stanzycanada/video/7681194653969943839',
    titleKey: 'v5Title',
    tagsKey: 'v5Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=85',
  },
  {
    key: 'v6',
    href: 'https://www.tiktok.com/@stanzycanada/video/7679181359193034015',
    titleKey: 'v6Title',
    tagsKey: 'v6Tags',
    thumbnail:
      'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=700&q=85',
  },
] as const;
