import { setRequestLocale } from 'next-intl/server';

import { publishedArticleMetadata } from '@/features/blog/server/blog-pages';
import { BlogArticleView } from '@/features/blog/views/blog-article-view';

type ArticleParams = Promise<{ locale: string; slug: string }>;

// Built on its first visit, then served from the cache like the other pages
// (otherwise every visit rendered it). Publishing clears it (the `blog` tag);
// at worst it refreshes after 5 minutes (BLOG_CACHE_SECONDS).
export const revalidate = 300;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export async function generateMetadata({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  return publishedArticleMetadata(slug, locale);
}

export default async function Page({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogArticleView locale={locale} slug={slug} />;
}
