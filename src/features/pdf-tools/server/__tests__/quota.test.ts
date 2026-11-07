import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FREE_COMPRESSIONS_PER_MONTH, monthWindow } from '@/features/pdf-tools/lib/quota';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

type Row = { accountId: string; createdAt: Date };

/** Seam: `pdfTools.quota` through a server-side caller, over an in-memory compression table. */
function fakeDatabase(rows: Row[] = []) {
  const db = {
    pdfCompression: {
      count: async ({ where }: { where: { accountId: string; createdAt: { gte: Date; lt: Date } } }) =>
        rows.filter(
          (row) =>
            row.accountId === where.accountId && row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt,
        ).length,
      create: async ({ data }: { data: { accountId: string } }) => {
        rows.push({ accountId: data.accountId, createdAt: new Date() });
        return data;
      },
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], rows };
}

const member = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const quotaFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).pdfTools.quota;

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-07T10:00:00Z') }));
afterEach(() => vi.useRealTimers());

describe('the Outil PDF’s free allowance', () => {
  it('counts the month’s compressions and refuses the eleventh', async () => {
    const { db } = fakeDatabase();
    for (let i = 0; i < FREE_COMPRESSIONS_PER_MONTH; i++) await quotaFor(db, member).use();
    expect(await quotaFor(db, member).get()).toEqual({
      used: 10,
      limit: 10,
      renewsAt: new Date('2026-12-01T00:00:00Z'),
    });
    await expect(quotaFor(db, member).use()).rejects.toMatchObject({ message: 'PDF_QUOTA_REACHED' });
  });

  it('starts again each calendar month, and counts each Account apart', async () => {
    const lastMonth = Array.from({ length: 10 }, () => ({ accountId: 'acc_1', createdAt: new Date('2026-10-31T23:00:00Z') }));
    const someoneElse = Array.from({ length: 10 }, () => ({ accountId: 'acc_2', createdAt: new Date('2026-11-02T09:00:00Z') }));
    const { db } = fakeDatabase([...lastMonth, ...someoneElse]);
    expect((await quotaFor(db, member).get()).used).toBe(0);
    await expect(quotaFor(db, member).use()).resolves.toMatchObject({ used: 1 });
  });

  it('has no limit for the consultant', async () => {
    const { db } = fakeDatabase(Array.from({ length: 30 }, () => ({ accountId: 'acc_stanzy', createdAt: new Date() })));
    await expect(quotaFor(db, consultant).use()).resolves.toMatchObject({ limit: null, used: 31 });
  });

  it('is for signed-in Accounts only', async () => {
    const { db } = fakeDatabase();
    const caller = createCaller({ prisma: db, session: null, headers: new Headers() } as unknown as TRPCContext);
    await expect(caller.pdfTools.quota.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('runs on UTC calendar months', () => {
    expect(monthWindow(new Date('2026-12-31T23:30:00Z'))).toEqual({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2027-01-01T00:00:00Z'),
    });
  });
});
