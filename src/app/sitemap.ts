import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site-url';
import { getSitemapArticles } from '@/features/blog/server/blog-pages';
import { routing } from '@/i18n/routing';

/** The public pages, in every language, and each published Article at its own language's address. */
const PAGES = [
  '',
  '/blog',
  '/outils',
  '/outils/crs',
  '/outils/67-points',
  '/outils/nclc-clb',
  '/outils/dernier-tirage',
  '/outils/prochain-tirage',
  '/outils/compte-a-rebours-ita',
  '/outils/timeline',
  '/outils/budget',
  '/outils/checklist',
  '/services/consultation',
  '/services/accompagnement',
  '/services/ede',
  '/services/verification',
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const articles = await getSitemapArticles();
  return [
    ...routing.locales.flatMap((locale) => PAGES.map((path) => ({ url: `${base}/${locale}${path}` }))),
    ...articles.map((article) => ({
      url: `${base}/${article.locale}/blog/${article.slug}`,
      lastModified: new Date(article.updatedAt),
    })),
  ];
}
