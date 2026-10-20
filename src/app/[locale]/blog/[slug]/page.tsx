import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BlogPlaceholderView } from '@/features/blog/views/blog-placeholder-view';
import { ARTICLES, type Article } from '@/features/landing/data/articles';

type ArticleParams = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: ArticleParams;
}) {
  const { locale, slug } = await params;
  const article = ARTICLES.find((a: Article): boolean => a.slug === slug);
  if (article) {
    const tArt = await getTranslations({
      locale,
      namespace: 'Home.BlogRow.Articles',
    });
    return { title: tArt(article.titleKey) };
  }
  const t = await getTranslations({ locale, namespace: 'BlogPlaceholder' });
  return { title: t('title') };
}

export default async function Page({ params }: { params: ArticleParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogPlaceholderView slug={slug} />;
}

// Pre-render the known article slugs; unknown slugs fall through to the
// generic "coming soon" variant at request time.
export function generateStaticParams(): Array<{ slug: string }> {
  return ARTICLES.map((a: Article): { slug: string } => ({ slug: a.slug }));
}

