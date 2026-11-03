import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { addHistoryInput, historyFilePrefix } from '@/features/pdf-tools/lib/history-schema';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

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
