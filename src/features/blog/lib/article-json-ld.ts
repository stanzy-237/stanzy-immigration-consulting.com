/** What an Article's structured data is made of. */
export type JsonLdArticle = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  authorName: string;
  publishedAt: Date;
  updatedAt: Date;
  categoryName: string;
  tags: string[];
};

/**
 * An Article for search and AI engines (schema.org `BlogPosting`), published
 * by the site's organization, with its share card as image, and the
 * breadcrumb that leads to it (Accueil › Blog › Article).
 */
export function articleJsonLd(article: JsonLdArticle, siteUrl: string, labels: { home: string; blog: string }): Record<string, unknown> {
  const url = `${siteUrl}/${article.locale}/blog/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: article.title,
        description: article.description,
        inLanguage: article.locale,
        datePublished: article.publishedAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        articleSection: article.categoryName,
        keywords: article.tags,
        image: `${url}/opengraph-image`,
        author: { '@type': 'Person', name: article.authorName },
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: labels.home, item: `${siteUrl}/${article.locale}` },
          { '@type': 'ListItem', position: 2, name: labels.blog, item: `${siteUrl}/${article.locale}/blog` },
          { '@type': 'ListItem', position: 3, name: article.title, item: url },
        ],
      },
    ],
  };
}
