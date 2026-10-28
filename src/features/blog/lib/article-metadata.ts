import type { Metadata } from 'next';

/** What an Article's search and share tags are made of. */
export type MetadataArticle = {
  slug: string;
  /** The language it is written in, so its canonical address is in that Blog. */
  locale: string;
  title: string;
  excerpt: string | null;
  /** The opening of the Article, for when the consultant wrote no excerpt. */
  fallbackExcerpt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  publishedAt: Date;
  updatedAt: Date;
  categoryName: string;
  tags: string[];
};

const DEFAULT_IMAGE = '/logo2.png';
const DEFAULT_IMAGE_ALT = 'Stanzy Immigration Consulting';

/**
 * An Article's `<title>`, meta description, canonical address and Open Graph
 * / Twitter tags. The consultant's SEO fields win; otherwise the title and
 * the excerpt (or the opening of the Article). No cover: the site's logo.
 */
export function articleMetadata(article: MetadataArticle, siteUrl: string): Metadata {
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || article.fallbackExcerpt;
  const url = `${siteUrl}/${article.locale}/blog/${article.slug}`;
  const image = article.coverUrl
    ? { url: article.coverUrl.startsWith('/') ? `${siteUrl}${article.coverUrl}` : article.coverUrl, alt: article.coverAlt ?? article.title }
    : { url: `${siteUrl}${DEFAULT_IMAGE}`, alt: DEFAULT_IMAGE_ALT };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      locale: article.locale === 'en' ? 'en_CA' : 'fr_CA',
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      section: article.categoryName,
      tags: article.tags,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}
