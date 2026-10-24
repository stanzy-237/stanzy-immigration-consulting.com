import type { Prisma, PrismaClient } from '@prisma/client';
import { createTranslator } from 'next-intl';

import { drawTypeKey } from '@/features/draws/lib/draw-type';
import { normalizeIrccRounds, type NormalizedDraw, type NormalizeResult } from '@/features/draws/lib/normalize-ircc-rounds';
import { toLocale, type Locale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

export const IRCC_FEED_URL = 'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json';

/** The one DrawSync row. */
export const SYNC_ID = 'ircc';

/** What a device shows for an Alerte tirage. `tag` makes a repeat replace, not stack. */
export type DrawAlert = { title: string; body: string; url: string; tag: string };

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

/** Delivers one alert. 'gone' means the push service says the subscription expired. */
export type PushSender = (subscription: StoredSubscription, alert: DrawAlert) => Promise<'sent' | 'gone'>;

export type IngestReport = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: NormalizeResult['skipped'];
  alerted: number;
};

type Db = Pick<PrismaClient, 'draw' | 'pushSubscription' | 'drawSync'>;

/** Reads IRCC's feed, fresh, with a timeout. */
export async function fetchIrccFeed(): Promise<unknown> {
  const response = await fetch(IRCC_FEED_URL, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`IRCC feed answered ${response.status}`);
  return response.json();
}

const MESSAGES = { fr, en } as const;

export function alertFor(draw: NormalizedDraw, locale: Locale): DrawAlert {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Draws' });
  const key = locale === 'fr' ? drawTypeKey(draw.typeLabel) : null;
  return {
    title: t('alert.title', { round: draw.round }),
    body: t('alert.body', {
      type: key ? t(`types.${key}` as 'types.pnp') : draw.typeLabel,
      invitations: new Intl.NumberFormat(locale).format(draw.invitations),
      crsMin: draw.crsMin,
    }),
    url: `/${locale}/outils/dernier-tirage`,
    tag: `draw-${draw.round}`,
  };
}

/** JSON with sorted keys: Postgres JSONB doesn't keep the feed's key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const columns = (draw: NormalizedDraw) => ({
  roundNumber: draw.roundNumber,
  date: new Date(`${draw.date}T00:00:00Z`),
  typeLabel: draw.typeLabel,
  group: draw.group,
  invitations: draw.invitations,
  crsMin: draw.crsMin,
  irccUrl: draw.irccUrl,
  raw: draw.raw as Prisma.InputJsonObject,
});

/**
 * Brings the Draw table in line with IRCC's feed, then sends one Alerte tirage
 * per new round to every subscribed device, whatever its owner's score.
 *
 * Idempotent: rounds are keyed by IRCC's draw number, unchanged rounds are not
 * written, and each alert is claimed (`notifiedAt`) before it goes out, so a
 * second or overlapping run never repeats one. The first run loads the whole
 * history already marked as notified, so it alerts nobody.
 */
export async function ingestDraws(deps: {
  db: Db;
  fetchFeed: () => Promise<unknown>;
  sendPush: PushSender;
  now: Date;
}): Promise<IngestReport> {
  const { db, sendPush, now } = deps;
  const { draws, skipped } = normalizeIrccRounds(await deps.fetchFeed());

  const stored = new Map(
    (await db.draw.findMany({ select: { round: true, raw: true } })).map((row) => [row.round, stable(row.raw)]),
  );
  const backfill = stored.size === 0;

  const fresh = draws.filter((draw) => !stored.has(draw.round));
  const changed = draws.filter((draw) => stored.has(draw.round) && stored.get(draw.round) !== stable(draw.raw));

  const { count: inserted } = await db.draw.createMany({
    data: fresh.map((draw) => ({
      round: draw.round,
      ...columns(draw),
      firstSeenAt: now,
      notifiedAt: backfill ? now : null,
    })),
    skipDuplicates: true,
  });
  for (const draw of changed) {
    await db.draw.update({ where: { round: draw.round }, data: columns(draw) });
  }
  await db.drawSync.upsert({ where: { id: SYNC_ID }, create: { id: SYNC_ID, syncedAt: now }, update: { syncedAt: now } });

  const alerted = await sendAlerts(db, draws, sendPush, now);
  return { fetched: draws.length + skipped.length, inserted, updated: changed.length, skipped, alerted };
}

async function sendAlerts(db: Db, draws: NormalizedDraw[], sendPush: PushSender, now: Date): Promise<number> {
  const pending = await db.draw.findMany({
    where: { notifiedAt: null },
    select: { round: true },
    orderBy: [{ date: 'asc' }, { roundNumber: 'asc' }, { round: 'asc' }],
  });
  const byRound = new Map(draws.map((draw) => [draw.round, draw]));
  let alerted = 0;

  for (const { round } of pending) {
    const draw = byRound.get(round);
    if (!draw) continue;
    // Claim it first: of two overlapping runs, only one sends.
    const { count } = await db.draw.updateMany({ where: { round, notifiedAt: null }, data: { notifiedAt: now } });
    if (count === 0) continue;
    alerted++;

    const subscriptions = await db.pushSubscription.findMany({ orderBy: [{ createdAt: 'asc' }] });
    const gone: string[] = [];
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, alertFor(draw, toLocale(subscription.locale))).catch((error: unknown) => {
        console.error(`Alerte tirage #${round} failed for a subscription`, error);
        return 'failed' as const;
      });
      if (result === 'gone') gone.push(subscription.endpoint);
    }
    if (gone.length > 0) await db.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } });
  }
  return alerted;
}
