import type { PrismaClient } from '@prisma/client';

import { BLOG_PAGE_SIZE, type BlogLocale } from '@/features/blog/lib/blog-schema';
import { renderArticle, type ArticleDoc } from '@/features/blog/lib/render-article';

type Db = Pick<PrismaClient, 'blogPost' | 'blogCategory'>;

export type BlogCategory = { slug: string; nameFr: string; nameEn: string };

/** An Article as a card in the Blog's list or the home page's row. */
export type ArticleCard = {
  slug: string;
  /** The language it is written in; the English Blog also lists French ones. */
  locale: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  coverAlt: string | null;
  category: BlogCategory;
  tags: string[];
  publishedAt: Date;
  readingMinutes: number;
};

/** A published Article, ready for its page. */
export type PublishedArticle = ArticleCard & {
  html: string;
  /** The consultant's excerpt, if any; `excerpt` falls back to the opening. */
  ownExcerpt: string | null;
  fallbackExcerpt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  authorName: string;
};

export type BlogListInput = { locale: BlogLocale; category?: string; tag?: string; page?: number };
export type BlogList = { items: ArticleCard[]; total: number; page: number; pageSize: number };

type PostWithCategory = Awaited<ReturnType<Db['blogPost']['findMany']>>[number] & {
  category: BlogCategory;
};

const toCard = (post: PostWithCategory): ArticleCard => {
  const rendered = renderArticle(post.content as ArticleDoc);
  return {
    slug: post.slug,
    locale: post.locale,
    title: post.title,
    excerpt: post.excerpt ?? rendered.excerpt,
    coverUrl: post.coverUrl,
    coverAlt: post.coverAlt,
    category: { slug: post.category.slug, nameFr: post.category.nameFr, nameEn: post.category.nameEn },
    tags: post.tags,
    publishedAt: post.publishedAt!,
    readingMinutes: post.readingMinutes,
  };
};

/**
 * The published Articles, newest first, 12 to a page. The French Blog lists
 * French Articles; the English Blog lists English ones, then the French ones.
 * Filtered in memory: the Blog holds dozens of Articles, not thousands, and
 * every read is cached until the next change.
 */
export async function listPublished(db: Db, input: BlogListInput): Promise<BlogList> {
  const page = Math.max(1, input.page ?? 1);
  const rows = (await db.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
  })) as PostWithCategory[];

  const rank = (locale: string) => (locale === input.locale ? 0 : 1);
  const matching = rows
    .filter((row) => (input.locale === 'fr' ? row.locale === 'fr' : true))
    .filter((row) => !input.category || row.category.slug === input.category)
    .filter((row) => !input.tag || row.tags.includes(input.tag))
    .toSorted((a, b) => rank(a.locale) - rank(b.locale) || b.publishedAt!.getTime() - a.publishedAt!.getTime());

  return {
    items: matching.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE).map(toCard),
    total: matching.length,
    page,
    pageSize: BLOG_PAGE_SIZE,
  };
}

/** A published Article by its slug, or null (a draft is never public). */
export async function findPublished(db: Db, slug: string): Promise<PublishedArticle | null> {
  const row = (await db.blogPost.findUnique({
    where: { slug },
    include: { category: true, author: { select: { name: true } } },
  })) as (PostWithCategory & { author: { name: string } }) | null;
  if (!row || row.status !== 'PUBLISHED') return null;

  const rendered = renderArticle(row.content as ArticleDoc);
  return {
    ...toCard(row),
    html: rendered.html,
    ownExcerpt: row.excerpt,
    fallbackExcerpt: rendered.excerpt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt,
    authorName: row.author.name,
  };
}

/** The consultant's categories, in their order. */
export async function listCategories(db: Db): Promise<(BlogCategory & { id: string })[]> {
  const rows = await db.blogCategory.findMany({ orderBy: { position: 'asc' } });
  return rows.map(({ id, slug, nameFr, nameEn }) => ({ id, slug, nameFr, nameEn }));
}
