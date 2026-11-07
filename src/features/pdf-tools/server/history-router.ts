import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { addHistoryInput, historyFilePrefix } from '@/features/pdf-tools/lib/history-schema';
import { FREE_COMPRESSIONS_PER_MONTH, monthWindow } from '@/features/pdf-tools/lib/quota';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const fields = {
  id: true,
  name: true,
  pageCount: true,
  size: true,
  changes: true,
  quality: true,
  sourceNames: true,
  createdAt: true,
} as const;

/**
 * The Outils PDF's history (#79): every PDF the consultant downloaded, kept
 * encrypted in R2 (ADR 0007) for 90 days, theirs only.
 */
export const pdfToolsRouter = createTRPCRouter({
  /**
   * The public Outil PDF's free allowance: 10 compressions per calendar month
   * for each Account, counted here so it holds across devices. The consultant
   * has no limit. Building and downloading are free and not counted.
   */
  quota: createTRPCRouter({
    get: protectedProcedure.query(({ ctx }) => quotaOf(ctx.prisma, ctx.session, new Date())),

    /** Counts one finished compression; PDF_QUOTA_REACHED once the month's allowance is used. */
    use: protectedProcedure.mutation(async ({ ctx }) => {
      const now = new Date();
      const quota = await quotaOf(ctx.prisma, ctx.session, now);
      if (quota.limit !== null && quota.used >= quota.limit) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'PDF_QUOTA_REACHED' });
      }
      await ctx.prisma.pdfCompression.create({ data: { accountId: ctx.session.account.id } });
      return { ...quota, used: quota.used + 1 };
    }),
  }),

  history: createTRPCRouter({
    /** Newest first. */
    list: consultantProcedure.query(({ ctx }) =>
      ctx.prisma.pdfToolFile.findMany({
        where: { createdById: ctx.session.account.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: fields,
      }),
    ),

    /** Records a downloaded PDF the browser encrypted and sent to R2. */
    add: consultantProcedure.input(addHistoryInput).mutation(async ({ ctx, input }) => {
      const wrappedKey = await acceptEncryptedUpload(input, historyFilePrefix(ctx.session.account.id));
      return ctx.prisma.pdfToolFile.create({
        data: {
          name: input.fileName,
          pageCount: input.pageCount,
          size: input.size,
          changes: input.changes,
          quality: input.quality,
          sourceNames: input.sourceNames,
          objectKey: input.objectKey,
          wrappedKey,
          iv: input.iv,
          createdById: ctx.session.account.id,
        },
        select: fields,
      });
    }),

    /** Removes a file from the history, and from R2. */
    delete: consultantProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.pdfToolFile.findFirst({
        where: { id: input.id, createdById: ctx.session.account.id },
        select: { id: true, objectKey: true },
      });
      if (!file) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.prisma.pdfToolFile.delete({ where: { id: file.id } });
      after(() => deleteFiles([file.objectKey]));
    }),
  }),
});

/** How many compressions the Account made this month, out of how many (null: no limit), and when it renews. */
async function quotaOf(db: TRPCContext['prisma'], session: CurrentSession, now: Date) {
  const { start, end } = monthWindow(now);
  const used = await db.pdfCompression.count({
    where: { accountId: session.account.id, createdAt: { gte: start, lt: end } },
  });
  return { used, limit: session.account.role === 'CONSULTANT' ? null : FREE_COMPRESSIONS_PER_MONTH, renewsAt: end };
}
