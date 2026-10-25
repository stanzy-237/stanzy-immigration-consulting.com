import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { MAX_ETAPES } from '@/features/parcours/data/etapes';
import { codeFromLabel } from '@/features/parcours/lib/etape-code';
import { etapeInputSchema, type Etape } from '@/features/parcours/lib/etape-schema';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** Restricts a query to the signed-in Account's own Étapes. */
const ownedBy = (ctx: { session: { account: { id: string } } }, id?: string) => ({
  ...(id === undefined ? {} : { id }),
  accountId: ctx.session.account.id,
});

/** A `@db.Date` column comes back as UTC midnight; send the calendar day. */
const toDay = (date: Date) => date.toISOString().slice(0, 10);
const fromDay = (day: string) => new Date(`${day}T00:00:00Z`);

const DAY_IN_MS = 86_400_000;

/**
 * The columns an add or an edit writes. The form stops dates after the User's
 * own today; the server allows one day more, since its today may be behind.
 */
const columns = (input: z.output<typeof etapeInputSchema>) => {
  if (input.date > toDay(new Date(Date.now() + DAY_IN_MS))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'PARCOURS_FUTURE_DATE' });
  }
  return {
    label: input.label,
    code: input.code || codeFromLabel(input.label),
    emoji: input.emoji,
    color: input.color,
    date: fromDay(input.date),
    note: input.note ?? '',
  };
};

const toEtape = (row: {
  id: string;
  label: string;
  code: string;
  emoji: string;
  color: string;
  date: Date;
  note: string;
}): Etape => ({
  id: row.id,
  label: row.label,
  code: row.code,
  emoji: row.emoji,
  color: row.color,
  date: toDay(row.date),
  note: row.note,
});

/**
 * The signed-in Account's Parcours: its dated Étapes. Another Account's Étape
 * answers NOT_FOUND, so ids are never confirmed.
 */
export const parcoursRouter = createTRPCRouter({
  /** The Account's Étapes, oldest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.parcoursEtape.findMany({
      where: ownedBy(ctx),
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toEtape);
  }),

  /** Refuses with PARCOURS_LIMIT once the Account holds MAX_ETAPES. */
  add: protectedProcedure.input(etapeInputSchema).mutation(async ({ ctx, input }) => {
    const data = columns(input);
    if ((await ctx.prisma.parcoursEtape.count({ where: ownedBy(ctx) })) >= MAX_ETAPES) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'PARCOURS_LIMIT' });
    }
    const row = await ctx.prisma.parcoursEtape.create({
      data: { accountId: ctx.session.account.id, ...data },
    });
    return toEtape(row);
  }),

  update: protectedProcedure
    .input(etapeInputSchema.extend(byId.shape))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.parcoursEtape.updateMany({
        where: ownedBy(ctx, input.id),
        data: columns(input),
      });
      if (count === 0) throw notFound();
      const row = await ctx.prisma.parcoursEtape.findFirst({ where: ownedBy(ctx, input.id) });
      if (!row) throw notFound();
      return toEtape(row);
    }),

  delete: protectedProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.parcoursEtape.deleteMany({ where: ownedBy(ctx, input.id) });
    if (count === 0) throw notFound();
  }),
});
