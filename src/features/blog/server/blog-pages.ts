import { unstable_cache } from 'next/cache';

import type { BlogLocale } from '@/features/blog/lib/blog-schema';
import { BLOG_CACHE_TAG } from '@/features/blog/server/blog-cache';
import {
  findPublished,
  listCategories,
  listPublished,
  type ArticleCard,
  type BlogList,
  type BlogListInput,
  type PublishedArticle,
} from '@/features/blog/server/blog-queries';
import { prisma } from '@/server/db/client';

/**
 * The public Blog's reads for server-rendered pages: the router's own queries,
 * cached until the consultant next changes something (`invalidateBlog`).
 * The cache stores JSON, so dates come back as strings and are revived here.
 */
const cached = <A extends unknown[], R>(key: string, read: (...args: A) => Promise<R>) =>
  unstable_cache(read, ['blog', key], { tags: [BLOG_CACHE_TAG] });

const reviveCard = <T extends ArticleCard>(card: T): T => ({ ...card, publishedAt: new Date(card.publishedAt) });

const cachedList = cached('list', (input: BlogListInput) => listPublished(prisma, input));
const cachedArticle = cached('article', (slug: string) => findPublished(prisma, slug));

export async function getBlogList(input: BlogListInput): Promise<BlogList> {
  const list = await cachedList(input);
  return { ...list, items: list.items.map(reviveCard) };
}

export async function getPublishedArticle(slug: string): Promise<PublishedArticle | null> {
  const article = await cachedArticle(slug);
  return article && { ...reviveCard(article), updatedAt: new Date(article.updatedAt) };
}

export const getBlogCategories = cached('categories', () => listCategories(prisma));

/**
 * The home page's row: the latest published Articles. A failed read hides
 * the row rather than the home page (e.g. before the Blog's migration ran).
 */
export async function getLatestArticles(locale: BlogLocale, count = 6): Promise<ArticleCard[]> {
  try {
    return (await getBlogList({ locale })).items.slice(0, count);
  } catch (error) {
    console.error('[blog] latest Articles unavailable', error);
    return [];
  }
}

/** Every published Article's address and last change, for the sitemap. */
export const getSitemapArticles = cached('sitemap', async () => {
  const rows = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true, locale: true, updatedAt: true },
  });
  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
});
