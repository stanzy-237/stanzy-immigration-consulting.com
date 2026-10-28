import { setRequestLocale } from 'next-intl/server';

import { siteUrl } from '@/features/blog/lib/site-url';
import { articleMetadata } from '@/features/blog/lib/article-metadata';
import { categoryName } from '@/features/blog/lib/category-name';
import { getPublishedArticle } from '@/features/blog/server/blog-pages';
import { BlogArticleView } from '@/features/blog/views/blog-article-view';

type ArticleParams = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return {};
  return articleMetadata(
    {
      ...article,
      excerpt: article.ownExcerpt,
      categoryName: categoryName(article.category, locale),
    },
    siteUrl(),
  );
}

export default async function Page({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogArticleView locale={locale} slug={slug} />;
}
