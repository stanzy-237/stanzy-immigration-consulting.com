import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

type Row = Record<string, unknown> & { id: string };

/** Seam: the Tableau de bord's Codes promo through a server-side caller, over in-memory codes and payments. */
function fakeDatabase(codes: Row[] = [], payments: Row[] = []) {
  const rows = codes.map((c) => ({ deletedAt: null, endsAt: null, places: null, oncePerAccount: true, services: ['CONSULTATION'], createdAt: new Date(), ...c }));
  const cleared: string[] = [];
  const db = {
    consultationSettings: { findUnique: async () => null },
    promoCode: {
      findMany: async () => rows.filter((r) => r.deletedAt === null),
      findFirst: async ({ where }: { where: { code: string } }) => rows.find((r) => r.code === where.code && r.deletedAt === null) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `promo_${rows.length + 1}`, deletedAt: null, ...data };
        rows.push(row as (typeof rows)[number]);
        return row;
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.find((r) => r.id === where.id && r.deletedAt === null);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    consultationPayment: {
      groupBy: async ({ where }: { where: { promoCodeId: { in: string[] } } }) => {
        const counts = new Map<string, number>();
        for (const p of payments) if (p.status === 'SUCCESS' && where.promoCodeId.in.includes(p.promoCodeId as string)) counts.set(p.promoCodeId as string, (counts.get(p.promoCodeId as string) ?? 0) + 1);
        return [...counts].map(([promoCodeId, n]) => ({ promoCodeId, _count: { _all: n } }));
      },
    },
    consultation: {
      updateMany: async ({ where }: { where: { promoCodeId: string } }) => {
        cleared.push(where.promoCodeId);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], rows, cleared };
}

const consultant = { account: { id: 'acc_stanzy', email: 'stanzy@example.com', name: 'Stanzy', role: 'CONSULTANT' } };
const caller = (db: TRPCContext['prisma'], session: unknown = consultant) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).promoCodes;

const sold = (codeId: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, promoCodeId: codeId, status: 'SUCCESS' }));

beforeEach(() => vi.clearAllMocks());

describe('promoCodes, Tableau de bord', () => {
  it('lists the codes with their places used (payments that succeeded) and their status', async () => {
    const { db } = fakeDatabase(
      [
        { id: 'a', code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70, places: 20 },
        { id: 'b', code: 'LANCEMENT', reductionType: 'PERCENT', reductionValue: 50, places: 10 },
      ],
      [...sold('a', 13), ...sold('b', 10), { id: 'x', promoCodeId: 'a', status: 'PENDING' }],
    );
    const { codes } = await caller(db).list();
    expect(codes.map((c) => [c.code, c.used, c.status])).toEqual([
      ['BLACKFRIDAY', 13, 'ACTIVE'],
      ['LANCEMENT', 10, 'SOLD_OUT'],
    ]);
  });

  it('makes a code in upper case, and refuses a text a live code already has', async () => {
    const { db, rows } = fakeDatabase([{ id: 'a', code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70 }]);
    const input = { code: 'noel', reductionType: 'AMOUNT' as const, reductionValue: 5000, services: ['CONSULTATION' as const], places: 50, endsAt: null, oncePerAccount: true };
    expect(await caller(db).create(input)).toMatchObject({ code: 'NOEL' });
    expect(rows.at(-1)).toMatchObject({ code: 'NOEL', createdById: 'acc_stanzy' });
    await expect(caller(db).create({ ...input, code: 'blackfriday' })).rejects.toThrow('PROMO_TAKEN');
  });

  it('deleting stops the code at once and takes it off the bookings still held', async () => {
    const { db, rows, cleared } = fakeDatabase([{ id: 'a', code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70 }]);
    await caller(db).remove({ id: 'a' });
    expect(rows[0]!.deletedAt).toBeInstanceOf(Date);
    expect(cleared).toEqual(['a']);
    expect((await caller(db).list()).codes).toEqual([]);
  });

  it('is the consultant’s only', async () => {
    const { db } = fakeDatabase();
    await expect(caller(db, { account: { id: 'acc_1', email: 'a@example.com', name: 'A', role: 'MEMBER' } }).list()).rejects.toThrow();
  });
});
