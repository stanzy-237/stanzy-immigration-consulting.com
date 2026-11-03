import { beforeEach, describe, expect, it } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: `notifications` through a server-side caller, over an in-memory
 * notification table (relations already joined, as Prisma returns them).
 */
type Row = { id: string; recipientId: string; readAt: Date | null; updatedAt: Date; [key: string]: unknown };

function fakeDatabase(rows: Row[]) {
  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return (condition as Record<string, unknown>[]).some((alt) => matches(row, alt));
      const value = row[key];
      if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        const c = condition as { lt?: unknown };
        return c.lt instanceof Date ? (value as Date) < c.lt : (value as string) < (c.lt as string);
      }
      if (condition instanceof Date) return (value as Date).getTime() === condition.getTime();
      return value === condition;
    });
  const notification = {
    async count({ where }: { where: Record<string, unknown> }) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async findMany({ where, take }: { where: Record<string, unknown>; take: number }) {
      return rows
        .filter((r) => matches(r, where))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || (a.id < b.id ? 1 : -1))
        .slice(0, take)
        .map((r) => ({ actor: null, dossier: null, document: null, comment: null, invoice: null, params: {}, ...r }));
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
  };
  return { prisma: { notification } as unknown as TRPCContext['prisma'], rows };
}

const at = (minutes: number) => new Date(Date.parse('2026-11-03T09:00:00Z') + minutes * 60_000);
const row = (id: string, recipientId: string, minutes: number, read = false): Row => ({
  id,
  recipientId,
  kind: 'MESSAGE_POSTED',
  count: 1,
  readAt: read ? at(minutes + 1) : null,
  updatedAt: at(minutes),
});

const asAminata = sessionFor();
const asBob = sessionFor({ id: 'acc_2' });
let db: ReturnType<typeof fakeDatabase>;
const as = (session: CurrentSession) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session }).notifications;

beforeEach(() => {
  db = fakeDatabase([row('n1', 'acc_1', 1, true), row('n2', 'acc_1', 2), row('n3', 'acc_1', 3), row('n4', 'acc_2', 4)]);
});

describe('an Account’s notifications', () => {
  it('counts and lists only its own, newest first, unread on demand', async () => {
    expect(await as(asAminata).unreadCount()).toBe(2);
    const all = await as(asAminata).list({ filter: 'ALL', limit: 10 });
    expect(all.items.map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
    expect((await as(asAminata).list({ filter: 'UNREAD', limit: 10 })).items.map((n) => n.id)).toEqual(['n3', 'n2']);
  });

  it('pages on with the cursor', async () => {
    const first = await as(asAminata).list({ filter: 'ALL', limit: 2 });
    expect(first.items.map((n) => n.id)).toEqual(['n3', 'n2']);
    const second = await as(asAminata).list({ filter: 'ALL', limit: 2, cursor: first.next });
    expect(second.items.map((n) => n.id)).toEqual(['n1']);
    expect(second.next).toBeNull();
  });

  it('marks one or all read, never someone else’s', async () => {
    await as(asBob).markRead({ id: 'n2' });
    expect(await as(asAminata).unreadCount()).toBe(2);
    await as(asAminata).markRead({ id: 'n2' });
    expect(await as(asAminata).unreadCount()).toBe(1);
    await as(asAminata).markAllRead({});
    expect(await as(asAminata).unreadCount()).toBe(0);
    expect(await as(asBob).unreadCount()).toBe(1);
  });

  it('needs a session', async () => {
    const anonymous = createCaller({ prisma: db.prisma, headers: new Headers(), session: null }).notifications;
    await expect(anonymous.unreadCount()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
