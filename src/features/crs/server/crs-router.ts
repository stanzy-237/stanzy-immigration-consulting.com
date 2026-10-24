import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  computeCrs,
  rulesInForceOn,
  type CrsBreakdown,
  type CrsProfile,
} from '@/features/crs/lib/compute-crs';
import { crsProfileSchema } from '@/features/crs/lib/profile-schema';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const name = z.string().trim().min(1).max(80);
const byId = z.object({ id: z.string().min(1) });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/**
 * Saved CRS simulations, each scoped to the signed-in Account. Another
 * Account's simulation answers NOT_FOUND, so ids are never confirmed.
 */
export const crsRouter = createTRPCRouter({
  /** Scores `profile` on the server (never trusting a client total) and saves it. */
  save: protectedProcedure
    .input(z.object({ name, profile: crsProfileSchema }))
    .mutation(async ({ ctx, input }) => {
      const rules = rulesInForceOn(new Date());
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
      return { id: row.id, name: row.name, total: row.total, rules: row.rules };
    }),

  /** The Account's simulations, most recently changed first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.crsSimulation.findMany({
      where: { accountId: ctx.session.account.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(({ id, name, total, rules, updatedAt }) => ({ id, name, total, rules, updatedAt }));
  }),

  /** One simulation with its answers, to reopen it in the calculator. */
  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const row = await ctx.prisma.crsSimulation.findFirst({
      where: { id: input.id, accountId: ctx.session.account.id },
    });
    if (!row) throw notFound();
    return {
      id: row.id,
      name: row.name,
      total: row.total,
      rules: row.rules,
      profile: row.profile as CrsProfile,
      breakdown: row.breakdown as CrsBreakdown,
    };
  }),

  rename: protectedProcedure
    .input(byId.extend({ name }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.crsSimulation.updateMany({
        where: { id: input.id, accountId: ctx.session.account.id },
        data: { name: input.name },
      });
      if (count === 0) throw notFound();
    }),

  delete: protectedProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.crsSimulation.deleteMany({
      where: { id: input.id, accountId: ctx.session.account.id },
    });
    if (count === 0) throw notFound();
  }),

  /** The latest saved score, for the hero card; null without one. */
  latest: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.prisma.crsSimulation.findFirst({
      where: { accountId: ctx.session.account.id },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? { total: row.total } : null;
  }),
});
