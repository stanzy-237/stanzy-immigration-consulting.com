import { z } from 'zod';

import { DOCUMENTS } from '@/features/checklist/lib/build-checklist';
import { checklistFormSchema } from '@/features/checklist/lib/checklist-form';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

/** A document's tick: `who:document`, e.g. `spouse:passport`. */
const readyKey = z
  .string()
  .regex(new RegExp(`^(you|spouse|children):(${DOCUMENTS.join('|')})$`));

/**
 * The signed-in Account's Checklist Entrée Express: its answers and the
 * documents it ticked « Prêt ». Visitors keep both in their browser.
 */
export const checklistRouter = createTRPCRouter({
  /** The answers (null until saved, or if saved in an older shape) and the ticks; null before anything was saved. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.prisma.checklist.findUnique({ where: { accountId: ctx.session.account.id } });
    if (!row) return null;
    const answers = checklistFormSchema.safeParse(row.answers);
    return { answers: answers.success ? answers.data : null, ready: row.ready };
  }),

  saveAnswers: protectedProcedure.input(checklistFormSchema).mutation(async ({ ctx, input }) => {
    const accountId = ctx.session.account.id;
    await ctx.prisma.checklist.upsert({
      where: { accountId },
      create: { accountId, answers: input },
      update: { answers: input },
    });
  }),

  /** Ticks or unticks one document; answers the ticks as saved. */
  setReady: protectedProcedure
    .input(z.object({ key: readyKey, ready: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const accountId = ctx.session.account.id;
      const row = await ctx.prisma.checklist.findUnique({ where: { accountId } });
      const others = (row?.ready ?? []).filter((key) => key !== input.key);
      const ready = input.ready ? [...others, input.key] : others;
      await ctx.prisma.checklist.upsert({
        where: { accountId },
        create: { accountId, ready },
        update: { ready },
      });
      return ready;
    }),
});
