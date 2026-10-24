import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  computeCrs,
  RULES_VERSIONS,
  rulesInForceOn,
  type CrsBreakdown,
  type CrsProfile,
} from '@/features/crs/lib/compute-crs';
import { crsProfileSchema } from '@/features/crs/lib/profile-schema';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const name = z.string().trim().min(1).max(80);
const byId = z.object({ id: z.string().min(1) });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** Restricts a query to the signed-in Account's own simulations. */
const ownedBy = (ctx: { session: { account: { id: string } } }, id?: string) => ({
  ...(id === undefined ? {} : { id }),
  accountId: ctx.session.account.id,
});

/** What a list entry shows of a simulation. */
const summary = (row: { id: string; name: string; total: number; rules: string; updatedAt: Date }) => ({
  id: row.id,
  name: row.name,
  total: row.total,
  rules: row.rules,
  updatedAt: row.updatedAt,
});

/**
 * Saved CRS simulations, each scoped to the signed-in Account. Another
 * Account's simulation answers NOT_FOUND, so ids are never confirmed.
 */
export const crsRouter = createTRPCRouter({
  /**
   * Scores `profile` on the server (never trusting a client total) and saves
   * it. `rules` lets a visitor save a preview of upcoming rules; rules that
   * are no longer in force are refused.
   */
  save: protectedProcedure
    .input(z.object({ name, profile: crsProfileSchema, rules: z.enum(RULES_VERSIONS).optional() }))
    .mutation(async ({ ctx, input }) => {
      const inForce = rulesInForceOn(new Date());
      const rules = input.rules ?? inForce;
      if (rules < inForce) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'CRS_RULES_EXPIRED' });
      }
      const result = computeCrs(input.profile, { rules });
      if (!result.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'CRS_PROFILE_INVALID', cause: result.issues });
      }
      const row = await ctx.prisma.crsSimulation.create({
        data: {
          accountId: ctx.session.account.id,
          name: input.name,
          profile: input.profile,
          total: result.breakdown.total,
          breakdown: result.breakdown,
          rules,
        },
      });
      return summary(row);
    }),

  /** The Account's simulations, most recently changed first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.crsSimulation.findMany({
      where: ownedBy(ctx),
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(summary);
  }),

  /** One simulation with its answers, to reopen it in the calculator. */
  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const row = await ctx.prisma.crsSimulation.findFirst({ where: ownedBy(ctx, input.id) });
    if (!row) throw notFound();
    return {
      ...summary(row),
      profile: row.profile as CrsProfile,
      breakdown: row.breakdown as CrsBreakdown,
    };
  }),

  rename: protectedProcedure
    .input(byId.extend({ name }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.crsSimulation.updateMany({
        where: ownedBy(ctx, input.id),
        data: { name: input.name },
      });
      if (count === 0) throw notFound();
    }),

  delete: protectedProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.crsSimulation.deleteMany({
      where: ownedBy(ctx, input.id),
    });
    if (count === 0) throw notFound();
  }),
});
