import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `parcours` tRPC router through a server-side caller. The database
 * is an in-memory stand-in for the Étape table, shared across callers so one
 * Account's rows are visible to (and must be hidden from) another.
 */
type Row = {
  id: string;
  accountId: string;
  label: string;
  code: string;
  emoji: string;
  color: string;
  date: Date;
  note: string;
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

  const parcoursEtape = {
    async create({ data }: { data: Omit<Row, 'id' | 'createdAt' | 'updatedAt'> }) {
      const now = tick();
      const row = { ...data, id: `etape_${rows.length + 1}`, createdAt: now, updatedAt: now };
      rows.push(row);
      return row;
    },
    async findMany({ where }: { where: Where }) {
      return rows
        .filter((r) => matches(r, where))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    },
    async findFirst({ where }: { where: Where }) {
      return (await parcoursEtape.findMany({ where }))[0] ?? null;
    },
    async count({ where }: { where: Where }) {
      return rows.filter((r) => matches(r, where)).length;
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
  return { prisma: { parcoursEtape } as unknown as TRPCContext['prisma'], rows };
}

function callerAs(db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) {
  return createCaller({ prisma: db.prisma, headers: new Headers(), session });
}

const AMINATA = sessionFor();
const MALLORY = sessionFor({ id: 'acc_2', email: 'mallory@example.com' });

const ITA = {
  label: 'Invitation à présenter une demande (ITA)',
  code: 'ITA',
  emoji: '✈️',
  color: 'stanzy-red',
  date: '2026-07-17',
} as const;

describe('parcours router', () => {
  it('refuses a signed-out caller as UNAUTHORIZED', async () => {
    await expect(callerAs(fakeDatabase(), null).parcours.list()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('adds Étapes and lists them in date order, as calendar days', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    await caller.parcours.add({ ...ITA, label: 'AOR reçu', code: 'AOR', color: 'green', date: '2026-08-03' });
    const ita = await caller.parcours.add({ ...ITA, note: 'Score CRS : 485' });

    expect(ita).toMatchObject({ code: 'ITA', date: '2026-07-17', note: 'Score CRS : 485' });
    expect(await caller.parcours.list()).toEqual([
      expect.objectContaining({ code: 'ITA', date: '2026-07-17', emoji: '✈️', color: 'stanzy-red' }),
      expect.objectContaining({ code: 'AOR', date: '2026-08-03', note: '' }),
    ]);
  });

  it('derives a free-form Étape’s code from the first word of its label', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    const free = { label: ITA.label, emoji: ITA.emoji, color: ITA.color, date: ITA.date };

    expect(await caller.parcours.add({ ...free, label: 'Équivalence des diplômes' })).toMatchObject({
      code: 'EQUIVALENC',
    });
    expect(await caller.parcours.add({ ...free, label: "  Pré-arrivée d'Aminata" })).toMatchObject({
      code: 'PREARRIVEE',
    });
    expect(await caller.parcours.add({ ...free, label: '🎉' })).toMatchObject({ code: 'ETAPE' });
  });

  it('edits an Étape in place and deletes it', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    const ita = await caller.parcours.add(ITA);
    const aor = await caller.parcours.add({ ...ITA, label: 'AOR', code: 'AOR', date: '2026-08-03' });

    const edited = await caller.parcours.update({ id: aor.id, ...ITA, label: 'ITA reçue', date: '2026-07-01' });

    expect(edited).toMatchObject({ id: aor.id, label: 'ITA reçue', code: 'ITA', date: '2026-07-01' });
    expect((await caller.parcours.list()).map((e) => e.id)).toEqual([aor.id, ita.id]);

    await caller.parcours.delete({ id: ita.id });
    expect((await caller.parcours.list()).map((e) => e.id)).toEqual([aor.id]);
  });

  it("never shows or changes another Account's Étapes", async () => {
    const db = fakeDatabase();
    const mine = await callerAs(db, AMINATA).parcours.add(ITA);
    const mallory = callerAs(db, MALLORY);

    expect(await mallory.parcours.list()).toEqual([]);
    await expect(mallory.parcours.update({ id: mine.id, ...ITA, label: 'pwned' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(mallory.parcours.delete({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.rows).toEqual([expect.objectContaining({ id: mine.id, label: ITA.label })]);
  });

  describe('validation', () => {
    afterEach(() => vi.useRealTimers());

    it.each([
      ['an empty label', { label: '   ' }],
      ['an emoji outside the catalogue', { emoji: '💩' }],
      ['a colour outside the palette', { color: '#ff0000' }],
      ['a date that is not a calendar day', { date: '17/07/2026' }],
      ['a note over 500 characters', { note: 'x'.repeat(501) }],
    ])('refuses %s as BAD_REQUEST', async (_, patch) => {
      await expect(
        callerAs(fakeDatabase(), AMINATA).parcours.add({ ...ITA, ...patch } as typeof ITA),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('refuses a date in the future, allowing a day for the User’s time zone', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-25T20:00:00Z') });
      const caller = callerAs(fakeDatabase(), AMINATA);

      await expect(caller.parcours.add({ ...ITA, date: '2026-10-26' })).resolves.toMatchObject({
        date: '2026-10-26',
      });
      await expect(caller.parcours.add({ ...ITA, date: '2026-10-27' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('refuses a 101st Étape with PARCOURS_LIMIT', async () => {
    const caller = callerAs(fakeDatabase(), AMINATA);
    for (let i = 0; i < 100; i++) await caller.parcours.add(ITA);

    await expect(caller.parcours.add(ITA)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'PARCOURS_LIMIT',
    });
  });
});
