import { describe, expect, it } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: « Recevoir sur ce téléphone » and the Alertes tirages switch, both on
 * one device, through server-side callers over an in-memory push_subscription table.
 */
type Row = Record<string, unknown> & { endpoint: string };

function fakeDatabase() {
  const rows: Row[] = [];
  const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => row[k] === v);
  const pushSubscription = {
    async upsert({
      where,
      create,
      update,
    }: {
      where: { endpoint: string };
      create: Row;
      update: Record<string, unknown>;
    }) {
      const row = rows.find((r) => r.endpoint === where.endpoint);
      if (row) Object.assign(row, update);
      else rows.push({ drawAlerts: true, notifications: false, ...create });
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async deleteMany({ where }: { where: Record<string, unknown> }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      return { count: hit.length };
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
  };
  return { prisma: { pushSubscription } as unknown as TRPCContext['prisma'], rows };
}

const endpoint = 'https://fcm.googleapis.com/fcm/send/phone';
const subscription = { endpoint, keys: { p256dh: 'k', auth: 'a' } };
const caller = (db: ReturnType<typeof fakeDatabase>) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session: sessionFor() });

describe('the two switches of one phone', () => {
  it('turns notifications on without turning Alertes tirages on', async () => {
    const db = fakeDatabase();
    await caller(db).notifications.push.subscribe({ subscription, locale: 'fr' });
    expect(db.rows).toEqual([
      expect.objectContaining({ endpoint, accountId: 'acc_1', notifications: true, drawAlerts: false }),
    ]);
    expect(await caller(db).notifications.push.status({ endpoint })).toEqual({ on: true });
  });

  it('keeps the phone for one switch when the other goes off, forgets it when both are', async () => {
    const db = fakeDatabase();
    await caller(db).draws.subscribe({ subscription, locale: 'fr' });
    await caller(db).notifications.push.subscribe({ subscription, locale: 'fr' });
    expect(db.rows[0]).toMatchObject({ drawAlerts: true, notifications: true });

    expect(await caller(db).notifications.push.unsubscribe({ endpoint })).toEqual({ forgotten: false });
    expect(db.rows[0]).toMatchObject({ drawAlerts: true, notifications: false });

    await caller(db).notifications.push.subscribe({ subscription, locale: 'fr' });
    await caller(db).draws.unsubscribe({ endpoint });
    expect(db.rows[0]).toMatchObject({ drawAlerts: false, notifications: true });

    expect(await caller(db).notifications.push.unsubscribe({ endpoint })).toEqual({ forgotten: true });
    expect(db.rows).toEqual([]);
  });
});
