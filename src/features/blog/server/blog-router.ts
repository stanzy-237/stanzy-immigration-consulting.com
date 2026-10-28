import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  articleInputSchema,
  BLOG_LOCALES,
  categoryInputSchema,
} from '@/features/blog/lib/blog-schema';
import { missingForPublish } from '@/features/blog/lib/publish-check';
import { renderArticle, type ArticleDoc } from '@/features/blog/lib/render-article';
import { invalidateBlog } from '@/features/blog/server/blog-cache';
import { findPublished, listCategories, listPublished } from '@/features/blog/server/blog-queries';
import { consultantProcedure, createTRPCRouter, publicProcedure } from '@/server/trpc/trpc';
import type { TRPCContext } from '@/server/trpc/context';

const byId = z.object({ id: z.string().min(1) });
const trpcError = (code: 'BAD_REQUEST' | 'CONFLICT' | 'NOT_FOUND', message?: string) => new TRPCError({ code, message });

type Db = TRPCContext['prisma'];

async function postOrThrow(db: Db, id: string) {
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) throw trpcError('NOT_FOUND');
  return post;
}

/** Another Article (or category) already answers at this slug. */
async function assertSlugFree(find: () => Promise<{ id: string } | null>, ownId?: string) {
  const other = await find();
  if (other && other.id !== ownId) throw trpcError('CONFLICT', 'BLOG_SLUG_TAKEN');
}

async function assertCategory(db: Db, id: string) {
  if (!(await db.blogCategory.findUnique({ where: { id } }))) throw trpcError('BAD_REQUEST', 'BLOG_CATEGORY_MISSING');
}

async function categoryOrThrow(db: Db, id: string) {
  const category = await db.blogCategory.findUnique({ where: { id } });
  if (!category) throw trpcError('NOT_FOUND');
  return category;
}

/** The columns a save writes: the input as validated, plus its reading time. */
const articleRow = (input: z.output<typeof articleInputSchema>) => ({
  ...input,
  content: input.content as unknown as Prisma.InputJsonValue,
  readingMinutes: renderArticle(input.content).readingMinutes,
});

/**
 * The Blog. Anyone reads the published Articles; only the consultant writes,
 * publishes and organises them, from the Tableau de bord. Every change clears
 * the public pages' cache.
 */
export const blogRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        locale: z.enum(BLOG_LOCALES),
        category: z.string().optional(),
        tag: z.string().optional(),
        page: z.number().int().min(1).optional(),
      }),
    )
    .query(({ ctx, input }) => listPublished(ctx.prisma, input)),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const article = await findPublished(ctx.prisma, input.slug);
    if (!article) throw trpcError('NOT_FOUND');
    return article;
  }),

  categories: publicProcedure.query(({ ctx }) => listCategories(ctx.prisma)),

  dashboard: createTRPCRouter({
    /** Every Article, last modified first. */
    list: consultantProcedure
      .input(z.object({ status: z.enum(['DRAFT', 'PUBLISHED']).optional() }))
      .query(async ({ ctx, input }) => {
        const rows = await ctx.prisma.blogPost.findMany({
          where: input.status ? { status: input.status } : {},
          include: { category: true },
        });
        return rows
          .toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            locale: row.locale,
            status: row.status,
            category: { nameFr: row.category.nameFr, nameEn: row.category.nameEn },
            updatedAt: row.updatedAt,
            publishedAt: row.publishedAt,
          }));
      }),

    get: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const post = await postOrThrow(ctx.prisma, input.id);
      return { ...post, html: renderArticle(post.content as unknown as ArticleDoc).html };
    }),

    create: consultantProcedure.input(articleInputSchema).mutation(async ({ ctx, input }) => {
      await assertSlugFree(() => ctx.prisma.blogPost.findUnique({ where: { slug: input.slug } }));
      await assertCategory(ctx.prisma, input.categoryId);
      const post = await ctx.prisma.blogPost.create({
        data: { ...articleRow(input), authorId: ctx.session.account.id },
      });
      invalidateBlog();
      return { id: post.id };
    }),

    update: consultantProcedure
      .input(articleInputSchema.and(byId))
      .mutation(async ({ ctx, input }) => {
        const { id, ...article } = input;
        await postOrThrow(ctx.prisma, id);
        await assertSlugFree(() => ctx.prisma.blogPost.findUnique({ where: { slug: article.slug } }), id);
        await assertCategory(ctx.prisma, article.categoryId);
        await ctx.prisma.blogPost.update({ where: { id }, data: articleRow(article) });
        invalidateBlog();
        return { id };
      }),

    /**
     * The publish date is set the first time only. Refused (BLOG_NOT_READY)
     * while the stored Article lacks what the editor also asks for: a title,
     * content, a category, alt text on its cover and every image.
     */
    publish: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const post = await postOrThrow(ctx.prisma, input.id);
      if (missingForPublish({ ...post, content: post.content as unknown as ArticleDoc }).length > 0) {
        throw trpcError('BAD_REQUEST', 'BLOG_NOT_READY');
      }
      await ctx.prisma.blogPost.update({
        where: { id: input.id },
        data: { status: 'PUBLISHED', publishedAt: post.publishedAt ?? new Date() },
      });
      invalidateBlog();
    }),

    unpublish: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      await postOrThrow(ctx.prisma, input.id);
      await ctx.prisma.blogPost.update({ where: { id: input.id }, data: { status: 'DRAFT' } });
      invalidateBlog();
    }),

    /** Drafts only: a published Article is unpublished first. */
    delete: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const post = await postOrThrow(ctx.prisma, input.id);
      if (post.status === 'PUBLISHED') throw trpcError('BAD_REQUEST', 'BLOG_DELETE_PUBLISHED');
      await ctx.prisma.blogPost.delete({ where: { id: input.id } });
      invalidateBlog();
    }),

    /** The tags already in use, for the editor's suggestions. */
    tags: consultantProcedure.query(async ({ ctx }) => {
      const rows = await ctx.prisma.blogPost.findMany({});
      return [...new Set(rows.flatMap((row) => row.tags))].toSorted();
    }),

    /** The Aperçu's figures. */
    summary: consultantProcedure.query(async ({ ctx }) => {
      const published = await ctx.prisma.blogPost.findMany({ where: { status: 'PUBLISHED' } });
      const last = published.toSorted((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0];
      return {
        drafts: await ctx.prisma.blogPost.count({ where: { status: 'DRAFT' } }),
        published: published.length,
        lastPublished: last ? { id: last.id, title: last.title, publishedAt: last.publishedAt! } : null,
      };
    }),

    categories: createTRPCRouter({
      create: consultantProcedure.input(categoryInputSchema).mutation(async ({ ctx, input }) => {
        await assertSlugFree(() => ctx.prisma.blogCategory.findUnique({ where: { slug: input.slug } }));
        const position = (await ctx.prisma.blogCategory.findMany({})).length;
        const category = await ctx.prisma.blogCategory.create({ data: { ...input, position } });
        invalidateBlog();
        return { id: category.id };
      }),

      update: consultantProcedure
        .input(categoryInputSchema.extend(byId.shape))
        .mutation(async ({ ctx, input }) => {
          const { id, ...data } = input;
          await categoryOrThrow(ctx.prisma, id);
          await assertSlugFree(() => ctx.prisma.blogCategory.findUnique({ where: { slug: data.slug } }), id);
          await ctx.prisma.blogCategory.update({ where: { id }, data });
          invalidateBlog();
        }),

      /** Refused while an Article uses it: every Article keeps a category. */
      delete: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
        await categoryOrThrow(ctx.prisma, input.id);
        if (await ctx.prisma.blogPost.count({ where: { categoryId: input.id } })) {
          throw trpcError('CONFLICT', 'BLOG_CATEGORY_IN_USE');
        }
        await ctx.prisma.blogCategory.delete({ where: { id: input.id } });
        invalidateBlog();
      }),
    }),
  }),
});

