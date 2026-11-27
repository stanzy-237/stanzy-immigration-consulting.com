import { articleShareImage } from '@/features/blog/server/article-share-image';

// Rebuilt with the Article's page (same cache, cleared on publish).
export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Stanzy · Blog';

// Like the Article page: no slug at build, each card built on its first request
// and then served from the cache (without this, every request drew it again).
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  return articleShareImage(slug, locale);
}
