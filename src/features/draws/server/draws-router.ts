import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { DrawGroup } from '@/features/draws/lib/draw-type';
import { irccInstant, roundOrder, type DrawSummary } from '@/features/draws/lib/draw-summary';
import { cachedDraws } from '@/features/draws/server/draws-cache';
import { SYNC_ID } from '@/features/draws/server/ingest-draws';
import { ingestNow } from '@/features/draws/server/ingest-now';
import { routing } from '@/i18n/routing';
import { pushEndpoint, pushSubscriptionInput } from '@/server/push/subscription-schema';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, humanOnly, publicProcedure } from '@/server/trpc/trpc';

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
  // The tie-breaking time; never `raw`, the feed object that is most of the table.
  drawCutOff: true,
} as const;

type Row = Omit<DrawSummary, 'date' | 'crsChange' | 'tieBreakAt'> & { date: Date; drawCutOff: string | null };

/** `rows` newest first; each gets its change from the next older row of its group. */
function withCrsChange(rows: Row[]): DrawSummary[] {
  const older = new Map<DrawGroup, number>();
  return rows
    .toReversed()
    .map(({ drawCutOff, ...row }) => {
      const previous = older.get(row.group);
      older.set(row.group, row.crsMin);
      return {
        ...row,
        date: row.date.toISOString().slice(0, 10),
        crsChange: previous === undefined ? null : row.crsMin - previous,
        tieBreakAt: irccInstant(drawCutOff),
      };
    })
    .toReversed();
}

type Db = TRPCContext['prisma'];

const endpoint = pushEndpoint;
const pushSubscription = pushSubscriptionInput;

/** Every Tirage's summary, newest first: cached until IRCC's feed is read again. */
const summaries = async (db: Db): Promise<Row[]> => {
  const rows = await cachedDraws(db, 'summaries', (prisma) => prisma.draw.findMany({ select: SUMMARY, orderBy: [...NEWEST_FIRST] }));
  // The cache keeps dates as strings: back to dates.
  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
};

/** When IRCC's feed was last read: cached the same way (a date survives the cache as a string). */
const lastSync = async (db: Db): Promise<Date | null> => {
  const at = await cachedDraws(db, 'sync', async (prisma) => (await prisma.drawSync.findUnique({ where: { id: SYNC_ID } }))?.syncedAt ?? null);
  return at === null ? null : new Date(at);
};

/** Derniers tirages: IRCC rounds stored by `ingestDraws`, and Alertes tirages opt-in. */
export const drawsRouter = createTRPCRouter({
  /** Every stored Tirage, newest first. A few hundred small rows: the page filters them itself. */
  list: publicProcedure.query(async ({ ctx }) => withCrsChange(await summaries(ctx.prisma))),

  /** The newest `take` Tirages and when IRCC's feed was last read. */
  latest: publicProcedure
    .input(z.object({ take: z.number().int().min(1).max(20).default(4) }))
    .query(async ({ ctx, input }) => {
      const [rows, lastSyncedAt] = await Promise.all([summaries(ctx.prisma), lastSync(ctx.prisma)]);
      return { draws: withCrsChange(rows).slice(0, input.take), lastSyncedAt };
    }),

  /** Opts this device in. Signed in, the subscription is linked to the Account. */
  subscribe: publicProcedure
    .use(humanOnly)
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

  /**
   * Tableau de bord → Aperçu, « Tirages IRCC »: when IRCC's feed was last
   * read and the newest Tirage stored.
   */
  sync: consultantProcedure.query(async ({ ctx }) => {
    const [sync, newest] = await Promise.all([
      ctx.prisma.drawSync.findUnique({ where: { id: SYNC_ID } }),
      ctx.prisma.draw.findFirst({ orderBy: [...NEWEST_FIRST], select: { round: true, date: true, crsMin: true, typeLabel: true } }),
    ]);
    return { lastSyncedAt: sync?.syncedAt ?? null, newest };
  }),

  /**
   * « Actualiser maintenant »: the daily refresh, run at once by the
   * consultant instead of waiting for it (or opening GitHub). Reads IRCC's
   * feed from here, stores new rounds and sends their Alertes tirages.
   */
  refresh: consultantProcedure.mutation(async () => {
    try {
      const report = await ingestNow();
      return { inserted: report.inserted, updated: report.updated, alerted: report.alerted };
    } catch (error) {
      console.error('[draws] refresh from the Tableau de bord failed', error);
      throw new TRPCError({ code: 'BAD_GATEWAY', message: 'IRCC_UNREACHABLE' });
    }
  }),
});
