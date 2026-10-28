import { setRequestLocale } from 'next-intl/server';

import { publishedArticleMetadata } from '@/features/blog/server/blog-pages';
import { BlogArticleView } from '@/features/blog/views/blog-article-view';

type ArticleParams = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  return publishedArticleMetadata(slug, locale);
}

export default async function Page({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogArticleView locale={locale} slug={slug} />;
}
