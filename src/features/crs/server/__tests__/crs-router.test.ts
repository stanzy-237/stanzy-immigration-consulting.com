import { describe, expect, it } from 'vitest';

import type { CrsProfile } from '@/features/crs/lib/compute-crs';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `crs` tRPC router through a server-side caller. The database is
 * an in-memory stand-in for the simulation table, shared across callers so
 * one Account's rows are visible to (and must be hidden from) another.
 */
type Row = {
  id: string;
  accountId: string;
  name: string;
  profile: unknown;
  total: number;
  breakdown: unknown;
  rules: string;
  createdAt: Date;
  updatedAt: Date;
};

function fakeDatabase() {
  const rows: Row[] = [];
  let clock = Date.parse('2026-10-24T12:00:00Z');
  const tick = () => new Date((clock += 1000));
  type Where = { id?: string; accountId?: string };
  const matches = (row: Row, where: Where) =>
    (where.id === undefined || row.id === where.id) &&
    (where.accountId === undefined || row.accountId === where.accountId);

  const crsSimulation = {
    async create({ data }: { data: Omit<Row, 'id' | 'createdAt' | 'updatedAt'> }) {
      const now = tick();
      const row = { ...data, id: `sim_${rows.length + 1}`, createdAt: now, updatedAt: now };
      rows.push(row);
      return row;
    },
    async findMany({ where }: { where: Where }) {
      return rows
        .filter((r) => matches(r, where))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },
    async findFirst({ where }: { where: Where }) {
      return (await crsSimulation.findMany({ where }))[0] ?? null;
    },
    async updateMany({ where, data }: { where: Where; data: Partial<Row> }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data, { updatedAt: tick() });
      return { count: hit.length };
    },
    async deleteMany({ where }: { where: Where }) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
  return { prisma: { crsSimulation } as unknown as TRPCContext['prisma'], rows };
}

function callerAs(db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) {
  return createCaller({ prisma: db.prisma, headers: new Headers(), session });
}

/** Single, 29, bachelor's, CLB 9, 3+ years abroad: 429 (see the engine tests). */
const PROFILE: CrsProfile = {
  maritalStatus: 'single',
  age: 29,
  education: 'bachelors',
  firstLanguage: { test: 'CLB', scores: { speaking: 9, listening: 9, reading: 9, writing: 9 } },
  secondLanguage: null,
  canadianWorkYears: 0,
  foreignWorkYears: 3,
  certificateOfQualification: false,
  canadianStudy: 'none',
  provincialNomination: false,
  siblingInCanada: false,
  highWageWork: 'none',
  highWageJobOffer: 'none',
};

const AMINATA = sessionFor();
const MALLORY = sessionFor({ id: 'acc_2', email: 'mallory@example.com' });

describe('crs router', () => {
  it('refuses a signed-out save as UNAUTHORIZED', async () => {
    await expect(
      callerAs(fakeDatabase(), null).crs.save({ name: 'Moi', profile: PROFILE }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('saves the score the server computes, whatever the client claims', async () => {
    const db = fakeDatabase();
    const caller = callerAs(db, AMINATA);

    const saved = await caller.crs.save({
      name: 'Aujourd’hui',
      profile: PROFILE,
      // A tampered client total is not part of the input and is ignored.
      ...({ total: 1200 } as object),
    });

    expect(saved).toMatchObject({ name: 'Aujourd’hui', total: 429 });
    expect(await caller.crs.list()).toEqual([
      expect.objectContaining({ id: saved.id, name: 'Aujourd’hui', total: 429 }),
    ]);
    expect(await caller.crs.get({ id: saved.id })).toMatchObject({
      profile: PROFILE,
      breakdown: expect.objectContaining({ total: 429 }),
    });
  });

  it('saves under the rules the visitor previewed, so the saved total matches the screen', async () => {
    // Under 2026-11-03: A 354 + labour market integration (64 + 70 = 134);
    // C: education 25 + 25 = 50, foreign work 50 + 50 → 50 → 100. Total 588.
    const caller = callerAs(fakeDatabase(), AMINATA);
    const saved = await caller.crs.save({
      name: 'Après le 3 novembre',
      profile: { ...PROFILE, canadianWorkYears: 3, highWageWork: '2x' },
      rules: '2026-11-03',
    });

    expect(saved).toMatchObject({ total: 588, rules: '2026-11-03' });
  });

  it('refuses a profile the engine cannot score as BAD_REQUEST', async () => {
    const bad = { ...PROFILE, age: 200 };
    await expect(
      callerAs(fakeDatabase(), AMINATA).crs.save({ name: 'x', profile: bad }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lists newest first, renames and deletes', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    const first = await caller.crs.save({ name: 'Avant TEF', profile: PROFILE });
    const second = await caller.crs.save({ name: 'Après TEF', profile: PROFILE });

    expect((await caller.crs.list()).map((s) => s.name)).toEqual(['Après TEF', 'Avant TEF']);

    await caller.crs.rename({ id: first.id, name: 'Sans TEF' });
    expect((await caller.crs.list()).map((s) => s.name)).toEqual(['Sans TEF', 'Après TEF']);

    await caller.crs.delete({ id: second.id });
    expect((await caller.crs.list()).map((s) => s.id)).toEqual([first.id]);
  });

  it("never shows or changes another Account's simulations", async () => {
    const db = fakeDatabase();
    const mine = await callerAs(db, AMINATA).crs.save({ name: 'Moi', profile: PROFILE });
    const mallory = callerAs(db, MALLORY);

    expect(await mallory.crs.list()).toEqual([]);
    await expect(mallory.crs.get({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(mallory.crs.rename({ id: mine.id, name: 'pwned' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(mallory.crs.delete({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.rows[0]).toMatchObject({ name: 'Moi' });
  });
});
