import { describe, expect, it } from 'vitest';

import feed from '@/features/draws/lib/__tests__/fixtures/ee-rounds.json';
import { ingestDraws, type DrawAlert, type PushSender } from '@/features/draws/server/ingest-draws';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: ingestion (`ingestDraws`, what the scheduled job runs) and the `draws`
 * tRPC router, through a server-side caller. The database is an in-memory
 * stand-in shared by both; the feed and the push service are fakes.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want && typeof want === 'object' && 'in' in want) return (want.in as unknown[]).includes(row[key]);
    return row[key] === want;
  });
}

function table(rows: Row[], key: string) {
  const pick = (row: Row, select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : { ...row };
  type OrderBy = Record<string, 'asc' | 'desc'>;
  const compare = (orderBy: OrderBy[] = []) => (a: Row, b: Row) => {
    for (const order of orderBy) {
      const [field, dir] = Object.entries(order)[0]!;
      const left = a[field] as never;
      const right = b[field] as never;
      if (left < right) return dir === 'asc' ? -1 : 1;
      if (left > right) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  };
  return {
    async findMany(args: { where?: Where; select?: Record<string, boolean>; orderBy?: OrderBy[]; take?: number } = {}) {
      return rows
        .filter((r) => matches(r, args.where))
        .sort(compare(args.orderBy))
        .slice(0, args.take)
        .map((r) => pick(r, args.select));
    },
    async findUnique({ where }: { where: Where }) {
      const row = rows.find((r) => matches(r, where));
      return row ? { ...row } : null;
    },
    async createMany({ data }: { data: Row[] }) {
      let count = 0;
      for (const row of data) {
        if (rows.some((r) => r[key] === row[key])) continue;
        rows.push({ ...row });
        count++;
      }
      return { count };
    },
    async update({ where, data }: { where: Where; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('Record to update not found.');
      return Object.assign(row, data);
    },
    async updateMany({ where, data }: { where: Where; data: Row }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
    async upsert({ where, create, update }: { where: Where; create: Row; update: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (row) return Object.assign(row, update);
      rows.push({ ...create });
      return create;
    },
    async deleteMany({ where }: { where?: Where } = {}) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
}

function fakeDatabase() {
  const draws: Row[] = [];
  const subscriptions: Row[] = [];
  const syncs: Row[] = [];
  const prisma = {
    draw: table(draws, 'round'),
    pushSubscription: table(subscriptions, 'endpoint'),
    drawSync: table(syncs, 'id'),
  };
  return prisma as unknown as TRPCContext['prisma'];
}

/** A real-looking push service endpoint for the device `name`. */
const endpointOf = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
const deviceOf = (endpoint: string) => endpoint.split('/').at(-1)!;

/** Records every alert by device name; devices in `gone` answer like an expired subscription. */
function fakePush(gone: string[] = []) {
  const sent: { endpoint: string; alert: DrawAlert }[] = [];
  const send: PushSender = async (subscription, alert) => {
    if (gone.includes(deviceOf(subscription.endpoint))) return 'gone';
    sent.push({ endpoint: deviceOf(subscription.endpoint), alert });
    return 'sent';
  };
  return { send, sent };
}

type Feed = { classes: string; rounds: Record<string, string>[] };
const fullFeed = (): Feed => structuredClone(feed);
/** The feed as IRCC published it before round 450. */
const feedBefore450 = (): Feed => ({ ...fullFeed(), rounds: fullFeed().rounds.slice(1) });

const NOW = new Date('2026-10-24T14:00:00Z');
const LATER = new Date('2026-10-24T15:00:00Z');

function ingest(db: TRPCContext['prisma'], body: unknown, push = fakePush(), now = NOW) {
  return ingestDraws({ db, fetchFeed: async () => body, sendPush: push.send, now });
}

const callerAs = (db: TRPCContext['prisma'], session: CurrentSession | null = null) =>
  createCaller({ prisma: db, headers: new Headers(), session });

const subscription = (device: string, endpoint = endpointOf(device)) => ({
  endpoint,
  keys: { p256dh: `p256-${device}`, auth: `auth-${device}` },
});

describe('draws ingestion and router', () => {
  it('loads the whole history on the first run, newest first, without the raw feed', async () => {
    const db = fakeDatabase();
    const report = await ingest(db, fullFeed());

    expect(report).toMatchObject({ fetched: 25, inserted: 25, updated: 0, skipped: [], alerted: 0 });
    const list = await callerAs(db).draws.list();
    expect(list).toHaveLength(25);
    expect(list.map((d) => d.round).slice(0, 4)).toEqual(['450', '449', '448', '447']);
    expect(list.at(-1)).toMatchObject({ round: '1', date: '2015-01-31', invitations: 779, crsMin: 886 });
    expect(list[0]).not.toHaveProperty('raw');
  });

  it('sends no alerts for the history it loads on the first run', async () => {
    const db = fakeDatabase();
    await callerAs(db).draws.subscribe({ subscription: subscription('phone'), locale: 'fr' });
    const push = fakePush();

    await ingest(db, fullFeed(), push);

    expect(push.sent).toEqual([]);
  });

  it('gives the same rows when it runs twice', async () => {
    const db = fakeDatabase();
    await ingest(db, fullFeed());
    const first = await callerAs(db).draws.list();

    const again = await ingest(db, fullFeed(), fakePush(), LATER);

    expect(again).toMatchObject({ fetched: 25, inserted: 0, updated: 0, alerted: 0 });
    expect(await callerAs(db).draws.list()).toEqual(first);
  });

  it('alerts every subscriber once for a new Tirage, whatever their CRS', async () => {
    const db = fakeDatabase();
    await ingest(db, feedBefore450());
    // A signed-in User whose saved CRS is far below round 450's cut-off still subscribes and is alerted.
    await callerAs(db, sessionFor()).draws.subscribe({ subscription: subscription('aminata'), locale: 'fr' });
    await callerAs(db).draws.subscribe({ subscription: subscription('visitor'), locale: 'en' });
    const push = fakePush();

    const report = await ingest(db, fullFeed(), push, LATER);

    expect(report).toMatchObject({ inserted: 1, alerted: 1 });
    expect(push.sent).toEqual([
      {
        endpoint: 'aminata',
        alert: {
          title: 'Nouveau tirage #450',
          body: expect.stringMatching(/^Connaissance du français · 5\s000 invitations · CRS 435$/),
          url: '/fr/outils/dernier-tirage',
          tag: 'draw-450',
        },
      },
      {
        endpoint: 'visitor',
        alert: {
          title: 'New draw #450',
          body: 'French-Language proficiency 2026-Version 2 · 5,000 invitations · CRS 435',
          url: '/en/outils/dernier-tirage',
          tag: 'draw-450',
        },
      },
    ]);

    const rerun = fakePush();
    await ingest(db, fullFeed(), rerun, LATER);
    expect(rerun.sent).toEqual([]);
  });

  it('updates a round IRCC corrected, without alerting', async () => {
    const db = fakeDatabase();
    await ingest(db, fullFeed());
    await callerAs(db).draws.subscribe({ subscription: subscription('phone'), locale: 'fr' });
    const corrected = fullFeed();
    corrected.rounds[1]!.drawSize = '2,600';
    const push = fakePush();

    const report = await ingest(db, corrected, push, LATER);

    expect(report).toMatchObject({ inserted: 0, updated: 1, alerted: 0 });
    expect((await callerAs(db).draws.list()).find((d) => d.round === '449')).toMatchObject({ invitations: 2600 });
    expect(push.sent).toEqual([]);
  });

  it('keeps the good rounds and reports a corrupted one', async () => {
    const db = fakeDatabase();
    const broken = fullFeed();
    broken.rounds[3]!.drawCRS = '';

    const report = await ingest(db, broken);

    expect(report).toMatchObject({ inserted: 24, skipped: [{ index: 3, reason: expect.any(String) }] });
  });

  it('fails without touching stored data when the feed is unreachable or malformed', async () => {
    const db = fakeDatabase();
    await ingest(db, fullFeed());

    await expect(
      ingestDraws({ db, fetchFeed: () => Promise.reject(new Error('ECONNRESET')), sendPush: fakePush().send, now: LATER }),
    ).rejects.toThrow();
    await expect(ingest(db, '<html>maintenance</html>', fakePush(), LATER)).rejects.toThrow();

    expect(await callerAs(db).draws.list()).toHaveLength(25);
    expect((await callerAs(db).draws.latest({ take: 1 })).lastSyncedAt).toEqual(NOW);
  });

  it('drops a subscription the push service reports as expired', async () => {
    const db = fakeDatabase();
    await ingest(db, { ...fullFeed(), rounds: fullFeed().rounds.slice(2) });
    await callerAs(db).draws.subscribe({ subscription: subscription('old-phone'), locale: 'fr' });
    await callerAs(db).draws.subscribe({ subscription: subscription('phone'), locale: 'fr' });

    await ingest(db, feedBefore450(), fakePush(['old-phone']), LATER);
    const push = fakePush();
    await ingest(db, fullFeed(), push, LATER);

    expect(push.sent.map((s) => s.endpoint)).toEqual(['phone']);
  });

  it('stops alerting a device that unsubscribed, and re-subscribing never duplicates', async () => {
    const db = fakeDatabase();
    await ingest(db, { ...fullFeed(), rounds: fullFeed().rounds.slice(2) });
    const visitor = callerAs(db);
    await visitor.draws.subscribe({ subscription: subscription('phone'), locale: 'fr' });
    await visitor.draws.subscribe({ subscription: subscription('phone'), locale: 'en' });
    await visitor.draws.subscribe({ subscription: subscription('tablet'), locale: 'fr' });
    await visitor.draws.unsubscribe({ endpoint: endpointOf('tablet') });
    const push = fakePush();

    await ingest(db, feedBefore450(), push, LATER);

    expect(push.sent).toEqual([{ endpoint: 'phone', alert: expect.objectContaining({ title: 'New draw #449' }) }]);
  });

  it('gives the latest Tirages with the change from the previous one of the same type', async () => {
    const db = fakeDatabase();
    await ingest(db, fullFeed());

    const latest = await callerAs(db).draws.latest({ take: 3 });

    expect(latest.lastSyncedAt).toEqual(NOW);
    expect(latest.draws).toEqual([
      // FRENCH: 435 vs round 388's 399.
      expect.objectContaining({ round: '450', group: 'FRENCH', crsMin: 435, crsChange: 36 }),
      // No earlier CEC round in the fixture.
      expect.objectContaining({ round: '449', group: 'CEC', crsMin: 519, crsChange: null }),
      // PNP: 772 vs round 91b's 902.
      expect.objectContaining({ round: '448', group: 'PNP', crsMin: 772, crsChange: -130 }),
    ]);
  });

  it('refuses an endpoint that is not a known push service', async () => {
    const visitor = callerAs(fakeDatabase());
    for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://169.254.169.254/latest', 'https://evil.example/fcm.googleapis.com']) {
      await expect(
        visitor.draws.subscribe({ subscription: subscription('x', endpoint), locale: 'fr' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(
      visitor.draws.subscribe({ subscription: subscription('x', 'https://web.push.apple.com/QGx'), locale: 'fr' }),
    ).resolves.toBeUndefined();
  });

  it('answers an empty table before the first run', async () => {
    const latest = await callerAs(fakeDatabase()).draws.latest({ take: 4 });
    expect(latest).toEqual({ draws: [], lastSyncedAt: null });
  });
});
