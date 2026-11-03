import { z } from 'zod';

import type { DrawGroup } from '@/features/draws/lib/draw-type';
import { irccInstant, roundOrder, type DrawSummary } from '@/features/draws/lib/draw-summary';
import { SYNC_ID } from '@/features/draws/server/ingest-draws';
import { routing } from '@/i18n/routing';
import { pushEndpoint, pushSubscriptionInput } from '@/server/push/subscription-schema';
import { createTRPCRouter, publicProcedure } from '@/server/trpc/trpc';

export type { DrawSummary };

const NEWEST_FIRST = roundOrder('desc');

const SUMMARY = {
  round: true,
  roundNumber: true,
  date: true,
  typeLabel: true,
  group: true,
  invitations: true,
  crsMin: true,
  irccUrl: true,
  // Read for the tie-breaking rule only; never sent to the browser.
  raw: true,
} as const;

type Row = Omit<DrawSummary, 'date' | 'crsChange' | 'tieBreakAt'> & { date: Date; raw: unknown };

/** `rows` newest first; each gets its change from the next older row of its group. */
function withCrsChange(rows: Row[]): DrawSummary[] {
  const older = new Map<DrawGroup, number>();
  return rows
    .toReversed()
    .map(({ raw, ...row }) => {
      const previous = older.get(row.group);
      older.set(row.group, row.crsMin);
      return {
        ...row,
        date: row.date.toISOString().slice(0, 10),
        crsChange: previous === undefined ? null : row.crsMin - previous,
        tieBreakAt: irccInstant((raw as { drawCutOff?: unknown } | null)?.drawCutOff),
      };
    })
    .toReversed();
}

const endpoint = pushEndpoint;
const pushSubscription = pushSubscriptionInput;

/** Derniers tirages: IRCC rounds stored by `ingestDraws`, and Alertes tirages opt-in. */
export const drawsRouter = createTRPCRouter({
  /** Every stored Tirage, newest first. A few hundred small rows: the page filters them itself. */
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.draw.findMany({ select: SUMMARY, orderBy: [...NEWEST_FIRST] });
    return withCrsChange(rows);
  }),

  /** The newest `take` Tirages and when IRCC's feed was last read. */
  latest: publicProcedure
    .input(z.object({ take: z.number().int().min(1).max(20).default(4) }))
    .query(async ({ ctx, input }) => {
      const [rows, sync] = await Promise.all([
        ctx.prisma.draw.findMany({ select: SUMMARY, orderBy: [...NEWEST_FIRST] }),
        ctx.prisma.drawSync.findUnique({ where: { id: SYNC_ID } }),
      ]);
      return { draws: withCrsChange(rows).slice(0, input.take), lastSyncedAt: sync?.syncedAt ?? null };
    }),

  /** Opts this device in. Signed in, the subscription is linked to the Account. */
  subscribe: publicProcedure
    .input(z.object({ subscription: pushSubscription, locale: z.enum(routing.locales) }))
    .mutation(async ({ ctx, input }) => {
      const { endpoint, keys } = input.subscription;
      const fields = {
        p256dh: keys.p256dh,
        auth: keys.auth,
        locale: input.locale,
        drawAlerts: true,
        ...(ctx.session ? { accountId: ctx.session.account.id } : {}),
      };
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, ...fields, createdAt: new Date() },
        update: fields,
      });
    }),

  /**
   * Opts this device out of Alertes tirages. It stays registered while it
   * still receives its Account's Notifications (#92); otherwise it's forgotten.
   */
  unsubscribe: publicProcedure
    .input(z.object({ endpoint }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, notifications: false } });
      await ctx.prisma.pushSubscription.updateMany({
        where: { endpoint: input.endpoint },
        data: { drawAlerts: false },
      });
    }),
});
