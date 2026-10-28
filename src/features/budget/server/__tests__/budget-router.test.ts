import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `budget` tRPC router through a server-side caller. The database
 * is an in-memory stand-in for the Dépense and budget-profile tables, shared
 * across callers so one Account's rows are visible to (and must be hidden
 * from) another.
 */
type ExpenseRow = {
  id: string;
  accountId: string;
  name: string;
  motif: string;
  amount: number;
  date: Date;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};
type ProfileRow = {
  id: string;
  accountId: string;
  currency: string | null;
  estimate: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function fakeDatabase() {
  const expenses: ExpenseRow[] = [];
  const profiles: ProfileRow[] = [];
  let clock = Date.parse('2026-10-24T12:00:00Z');
  const tick = () => new Date((clock += 1000));
  type Where = { id?: string; accountId?: string };
  const matches = (row: { id: string; accountId: string }, where: Where) =>
    (where.id === undefined || row.id === where.id) &&
    (where.accountId === undefined || row.accountId === where.accountId);

  const budgetExpense = {
    async create({ data }: { data: Omit<ExpenseRow, 'id' | 'createdAt' | 'updatedAt'> }) {
      const now = tick();
      const row = { ...data, id: `exp_${expenses.length + 1}`, createdAt: now, updatedAt: now };
      expenses.push(row);
      return row;
    },
    async findMany({ where }: { where: Where }) {
      return expenses
        .filter((r) => matches(r, where))
        .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findFirst({ where }: { where: Where }) {
      return (await budgetExpense.findMany({ where }))[0] ?? null;
    },
    async count({ where }: { where: Where }) {
      return expenses.filter((r) => matches(r, where)).length;
    },
    async updateMany({ where, data }: { where: Where; data: Partial<ExpenseRow> }) {
      const hit = expenses.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data, { updatedAt: tick() });
      return { count: hit.length };
    },
    async deleteMany({ where }: { where: Where }) {
      const before = expenses.length;
      for (let i = expenses.length - 1; i >= 0; i--) if (matches(expenses[i]!, where)) expenses.splice(i, 1);
      return { count: before - expenses.length };
    },
  };

  const budgetProfile = {
    async findUnique({ where }: { where: { accountId: string } }) {
      return profiles.find((p) => p.accountId === where.accountId) ?? null;
    },
    async upsert({
      where,
      create,
      update,
    }: {
      where: { accountId: string };
      create: Partial<ProfileRow> & { accountId: string };
      update: Partial<ProfileRow>;
    }) {
      const found = profiles.find((p) => p.accountId === where.accountId);
      if (found) return Object.assign(found, update, { updatedAt: tick() });
      const now = tick();
      const row = { currency: null, estimate: null, ...create, id: `prof_${profiles.length + 1}`, createdAt: now, updatedAt: now };
      profiles.push(row);
      return row;
    },
  };

  return { prisma: { budgetExpense, budgetProfile } as unknown as TRPCContext['prisma'], expenses, profiles };
}

function callerAs(db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) {
  return createCaller({ prisma: db.prisma, headers: new Headers(), session });
}

const AMINATA = sessionFor();
const MALLORY = sessionFor({ id: 'acc_2', email: 'mallory@example.com' });

const TEF = {
  name: 'TEF Canada',
  motif: 'languageTest',
  amount: 210_000,
  date: '2026-09-12',
} as const;

describe('budget router', () => {
  it('refuses a signed-out caller as UNAUTHORIZED', async () => {
    const caller = callerAs(fakeDatabase(), null);
    await expect(caller.budget.expenses.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.budget.profile.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  describe('expenses', () => {
    it('adds Dépenses and lists them newest date first, as calendar days', async () => {
      const caller = callerAs(fakeDatabase(), AMINATA);
      await caller.budget.expenses.add(TEF);
      const wes = await caller.budget.expenses.add({
        name: 'WES',
        motif: 'eca',
        amount: 132_000,
        date: '2026-10-02',
        note: 'Diplôme de licence',
      });

      expect(wes).toMatchObject({ name: 'WES', motif: 'eca', amount: 132_000, date: '2026-10-02', note: 'Diplôme de licence' });
      expect(await caller.budget.expenses.list()).toEqual([
        expect.objectContaining({ name: 'WES', date: '2026-10-02' }),
        expect.objectContaining({ name: 'TEF Canada', motif: 'languageTest', amount: 210_000, date: '2026-09-12', note: '' }),
      ]);
    });

    it('edits a Dépense in place and deletes it', async () => {
      const caller = callerAs(fakeDatabase(), AMINATA);
      const tef = await caller.budget.expenses.add(TEF);
      const other = await caller.budget.expenses.add({ ...TEF, name: 'Photos', motif: 'other', amount: 5_000 });

      const edited = await caller.budget.expenses.update({ id: tef.id, ...TEF, amount: 215_000, date: '2026-09-13' });
      expect(edited).toMatchObject({ id: tef.id, amount: 215_000, date: '2026-09-13' });

      await caller.budget.expenses.delete({ id: other.id });
      expect((await caller.budget.expenses.list()).map((e) => e.id)).toEqual([tef.id]);
    });

    it("never shows or changes another Account's Dépenses", async () => {
      const db = fakeDatabase();
      const mine = await callerAs(db, AMINATA).budget.expenses.add(TEF);
      const mallory = callerAs(db, MALLORY);

      expect(await mallory.budget.expenses.list()).toEqual([]);
      await expect(mallory.budget.expenses.update({ id: mine.id, ...TEF, amount: 1 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(mallory.budget.expenses.delete({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(db.expenses).toEqual([expect.objectContaining({ id: mine.id, amount: 210_000 })]);
    });

    describe('validation', () => {
      afterEach(() => vi.useRealTimers());

      it.each([
        ['an empty name', { name: '  ' }],
        ['a reason outside the list', { motif: 'casino' }],
        ['a zero amount', { amount: 0 }],
        ['a negative amount', { amount: -5 }],
        ['a fractional minor-unit amount', { amount: 10.5 }],
        ['an amount over the maximum', { amount: 1_000_000_001 }],
        ['a date that is not a calendar day', { date: '12/09/2026' }],
        ['a note over 500 characters', { note: 'x'.repeat(501) }],
      ])('refuses %s as BAD_REQUEST', async (_, patch) => {
        await expect(
          callerAs(fakeDatabase(), AMINATA).budget.expenses.add({ ...TEF, ...patch } as typeof TEF),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      });

      it('refuses a date in the future, allowing a day for the User’s time zone', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-25T20:00:00Z') });
        const caller = callerAs(fakeDatabase(), AMINATA);

        await expect(caller.budget.expenses.add({ ...TEF, date: '2026-10-26' })).resolves.toMatchObject({
          date: '2026-10-26',
        });
        await expect(caller.budget.expenses.add({ ...TEF, date: '2026-10-27' })).rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: 'BUDGET_FUTURE_DATE',
        });
      });
    });

    it('refuses a 501st Dépense with BUDGET_LIMIT', async () => {
      const caller = callerAs(fakeDatabase(), AMINATA);
      for (let i = 0; i < 500; i++) await caller.budget.expenses.add(TEF);

      await expect(caller.budget.expenses.add(TEF)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'BUDGET_LIMIT',
      });
    });
  });

  describe('profile', () => {
    it('has no profile until the User sets a currency', async () => {
      expect(await callerAs(fakeDatabase(), AMINATA).budget.profile.get()).toBeNull();
    });

    it('changes the currency without converting the amounts already logged', async () => {
      const caller = callerAs(fakeDatabase(), AMINATA);
      await caller.budget.profile.setCurrency({ currency: 'XAF' });
      await caller.budget.expenses.add(TEF);

      await caller.budget.profile.setCurrency({ currency: 'CAD' });

      expect(await caller.budget.profile.get()).toEqual({ currency: 'CAD' });
      expect(await caller.budget.expenses.list()).toEqual([expect.objectContaining({ amount: 210_000 })]);
    });

    it('refuses a currency outside the list', async () => {
      await expect(
        callerAs(fakeDatabase(), AMINATA).budget.profile.setCurrency({ currency: 'GBP' as 'CAD' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('keeps each Account’s profile to itself', async () => {
      const db = fakeDatabase();
      await callerAs(db, AMINATA).budget.profile.setCurrency({ currency: 'EUR' });

      expect(await callerAs(db, MALLORY).budget.profile.get()).toBeNull();
    });
  });
});
