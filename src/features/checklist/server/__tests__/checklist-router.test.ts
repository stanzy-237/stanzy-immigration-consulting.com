import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST_FORM } from '@/features/checklist/lib/checklist-form';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `checklist` tRPC router through a server-side caller, over an
 * in-memory checklist table shared by every caller.
 */
type Row = { accountId: string; answers: unknown; ready: string[] };

function fakeDatabase() {
  const rows: Row[] = [];
  const checklist = {
    async findUnique({ where }: { where: { accountId: string } }) {
      return rows.find((r) => r.accountId === where.accountId) ?? null;
    },
    async upsert({ where, create, update }: { where: { accountId: string }; create: Partial<Row> & { accountId: string }; update: Partial<Row> }) {
      const found = rows.find((r) => r.accountId === where.accountId);
      if (found) return Object.assign(found, update);
      const row = { answers: null, ready: [], ...create };
      rows.push(row);
      return row;
    },
  };
  return { prisma: { checklist } as unknown as TRPCContext['prisma'], rows };
}

const callerAs = (db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session });

const AMINATA = sessionFor();
const MALLORY = sessionFor({ id: 'acc_2', email: 'mallory@example.com' });
const MARRIED = { ...DEFAULT_CHECKLIST_FORM, maritalStatus: 'married', spouseAccompanying: true, children: 2 } as const;

describe('checklist router', () => {
  it('refuses a signed-out caller as UNAUTHORIZED', async () => {
    const caller = callerAs(fakeDatabase(), null);
    await expect(caller.checklist.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.checklist.saveAnswers(MARRIED)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('answers null before anything was saved', async () => {
    expect(await callerAs(fakeDatabase(), AMINATA).checklist.get()).toBeNull();
  });

  it('saves the answers and the ticks, and gives them back', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    await caller.checklist.saveAnswers(MARRIED);
    await caller.checklist.setReady({ key: 'you:passport', ready: true });
    expect(await caller.checklist.setReady({ key: 'spouse:passport', ready: true })).toEqual(['you:passport', 'spouse:passport']);

    expect(await caller.checklist.setReady({ key: 'you:passport', ready: false })).toEqual(['spouse:passport']);
    expect(await caller.checklist.get()).toEqual({ answers: MARRIED, ready: ['spouse:passport'] });
  });

  it('keeps one Account’s checklist from another', async () => {
    const db = fakeDatabase();
    await callerAs(db, AMINATA).checklist.saveAnswers(MARRIED);
    await callerAs(db, AMINATA).checklist.setReady({ key: 'you:passport', ready: true });

    expect(await callerAs(db, MALLORY).checklist.get()).toBeNull();
    await callerAs(db, MALLORY).checklist.setReady({ key: 'you:eca', ready: true });
    expect((await callerAs(db, AMINATA).checklist.get())?.ready).toEqual(['you:passport']);
  });

  it('refuses a tick for a document the Checklist doesn’t know', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    await expect(caller.checklist.setReady({ key: 'you:<script>', ready: true })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.checklist.setReady({ key: 'cousin:passport', ready: true })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('drops answers saved in a shape the form no longer has, keeping the ticks', async () => {
    const db = fakeDatabase();
    db.rows.push({ accountId: AMINATA.account.id, answers: { old: true }, ready: ['you:passport'] });

    expect(await callerAs(db, AMINATA).checklist.get()).toEqual({ answers: null, ready: ['you:passport'] });
  });
});
