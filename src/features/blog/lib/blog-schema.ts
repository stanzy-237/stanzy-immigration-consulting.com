import { z } from 'zod';

import { safeImageSrc, type ArticleDoc } from '@/features/blog/lib/render-article';

/** Articles in the Blog's list, per page. */
export const BLOG_PAGE_SIZE = 12;

/** Suggested limits for search results; the form counts against them. */
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

export const BLOG_LOCALES = ['fr', 'en'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

export const toBlogLocale = (value: string): BlogLocale => (value === 'en' ? 'en' : 'fr');

/** Lowercase words joined by hyphens, accents dropped: « Équivalence ECA » → `equivalence-eca`. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const slugSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'BLOG_SLUG_INVALID');

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => value?.trim() || null);

/** The stored document's outer shape; the renderer checks every node inside. */
const articleDocSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.record(z.string(), z.unknown())).optional() })
  .transform((doc) => doc as ArticleDoc);

/** An Article as the editor saves it. Tags come back normalised and deduplicated. */
export const articleInputSchema = z
  .object({
    slug: slugSchema,
    locale: z.enum(BLOG_LOCALES),
    title: z.string().trim().min(1).max(200),
    excerpt: optionalText(300),
    content: articleDocSchema,
    // An uploaded image, an https address, or an image on this site (`/blog/…`).
    coverUrl: z
      .string()
      .max(500)
      .nullish()
      .transform((value) => value?.trim() || null)
      .refine((value) => value === null || safeImageSrc(value) !== null, 'BLOG_COVER_INVALID'),
    coverAlt: optionalText(200),
    categoryId: z.string().min(1),
    tags: z
      .array(z.string().max(60))
      .max(20)
      .transform((tags) => [...new Set(tags.map(slugify).filter(Boolean))]),
    seoTitle: optionalText(120),
    seoDescription: optionalText(300),
  })
  .refine((input) => !input.coverUrl || input.coverAlt, { message: 'BLOG_COVER_ALT_MISSING', path: ['coverAlt'] });

export type ArticleInput = z.input<typeof articleInputSchema>;

export const categoryInputSchema = z.object({
  slug: slugSchema,
  nameFr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
});

/** The Blog section's status filter: every Article, or one status. */
export type DashboardStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

/** The dashboard list query's input for a filter (the route prefetches `ALL`'s). */
export const dashboardListInput = (filter: DashboardStatusFilter) => (filter === 'ALL' ? {} : { status: filter });
