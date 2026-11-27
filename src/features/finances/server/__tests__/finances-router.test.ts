import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { makeMonthlyCopies } from '@/features/finances/server/repeat-charges';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const storage = vi.hoisted(() => ({ objectSize: vi.fn(), deleteObjects: vi.fn() }));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `finances` through a server-side caller, over an in-memory stand-in
 * for the Facture, Recette, Charge, category and CAD rate tables. Date
 * filters are ignored: every row sits in the year asked.
 */
function fakeDatabase() {
  const client = { name: 'Aminata Diallo', email: 'aminata@example.com' };
  const dossiers: Row[] = [
    {
      id: 'dos_1',
      service: 'ACCOMPAGNEMENT',
      account: client,
      servicePrice: null,
      // #158: the Dossier's signed Contrat prices its own service; no partner works on it.
      contracts: [{ amount: 1_500_000 }],
    },
  ];
  // #158: a « Stanzy s'en charge » request taken on; its price and its partner's come from the catalogue
  // until negotiated. A declined one never counts (the query filters on status).
  const requests: Row[] = [
    {
      id: 'req_police',
      dossierId: 'dos_1',
      status: 'ACCEPTED',
      agreedPrice: null,
      partnerPrice: null,
      contract: null,
      service: { name: { fr: 'Certificat de police' }, priceKind: 'FIXED', price: 40_000, partnerPrice: 20_000 },
    },
    {
      id: 'req_declined',
      dossierId: 'dos_1',
      status: 'DECLINED',
      agreedPrice: 99_999,
      partnerPrice: null,
      contract: null,
      service: null,
    },
  ];
  const invoices: Row[] = [
    {
      id: 'inv_1',
      number: 'STZ-2026-0001',
      status: 'PAID',
      currency: 'XAF',
      paidAt: new Date('2026-02-03T10:00:00Z'),
      dossierId: 'dos_1',
      dossier: dossiers[0],
      lines: [{ quantity: 1, unitAmount: 400_000 }],
    },
    {
      id: 'inv_2',
      number: 'STZ-2026-0002',
      status: 'PARTIALLY_PAID',
      currency: 'XAF',
      paidAt: null,
      dossierId: 'dos_1',
      dossier: dossiers[0],
      lines: [{ quantity: 1, unitAmount: 999_999 }],
    },
    {
      id: 'inv_3',
      number: 'STZ-2026-0003',
      status: 'CANCELLED',
      currency: 'XAF',
      paidAt: null,
      dossierId: 'dos_1',
      dossier: dossiers[0],
      lines: [{ quantity: 1, unitAmount: 50_000 }],
    },
  ];
  // Each Paiement is a Recette on the day it was received (#145), part payments included.
  const payments: Row[] = [
    { id: 'pay_1', invoiceId: 'inv_1', amount: 400_000, receivedOn: '2026-02-03' },
    { id: 'pay_2', invoiceId: 'inv_2', amount: 100_000, receivedOn: '2026-02-20' },
    { id: 'pay_3', invoiceId: 'inv_3', amount: 50_000, receivedOn: '2026-02-21' },
  ];
  const categories: Row[] = [
    { id: 'cat_rent', name: 'Loyer', position: 1, archivedAt: null },
    { id: 'cat_old', name: 'Ancienne', position: 2, archivedAt: new Date('2026-01-01') },
  ];
  const incomes: Row[] = [];
  const charges: Row[] = [];
  const consultationPayments: { amount: number; currency: string; status: string; settledAt: Date | null }[] = [];
  const rates: Row[] = [];
  let seq = 0;

  const linked = (where: Record<string, unknown> | undefined, row: Row) => {
    const dossierId = where?.dossierId;
    if (dossierId === undefined) return true;
    if (dossierId && typeof dossierId === 'object') return row.dossierId != null;
    return row.dossierId === dossierId;
  };
  const withRelations = (row: Row) => ({
    ...row,
    dossier: dossiers.find((d) => d.id === row.dossierId) ?? null,
    category: categories.find((c) => c.id === row.categoryId),
  });

  const db = {
    dossier: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const dossier = dossiers.find((d) => d.id === where.id);
        if (!dossier) return null;
        const own = invoices
          .filter((invoice) => invoice.dossierId === dossier.id)
          .map((invoice) => ({ ...invoice, payments: payments.filter((payment) => payment.invoiceId === invoice.id) }));
        return { ...dossier, invoices: own };
      },
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        dossiers.filter((d) => where.id.in.includes(d.id)),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(dossiers.find((d) => d.id === where.id)!, data);
      },
    },
    stanzyRequest: {
      findMany: async ({ where }: { where: { document: { section: { dossierId: string } }; status: { in: string[] } } }) =>
        requests.filter((r) => r.dossierId === where.document.section.dossierId && where.status.in.includes(r.status as string)),
      updateMany: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = requests.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
    payment: {
      findMany: async ({ where }: { where: { invoice: { status: { not: string }; dossierId?: string } } }) =>
        payments
          .map((payment) => ({ ...payment, invoice: invoices.find((i) => i.id === payment.invoiceId)! }))
          .filter(({ invoice }) => invoice.status !== where.invoice.status.not && linked(where.invoice, invoice)),
    },
    consultationPayment: {
      findMany: async ({ where }: { where: { status: string; settledAt: { gte: Date; lt: Date } } }) =>
        consultationPayments.filter(
          (p) => p.status === where.status && p.settledAt && p.settledAt >= where.settledAt.gte && p.settledAt < where.settledAt.lt,
        ),
    },
    income: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        incomes.filter((row) => linked(where, row)).map(withRelations),
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `inc_${++seq}` };
        incomes.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = incomes.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        const index = incomes.findIndex((r) => r.id === where.id);
        if (index >= 0) incomes.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
      },
    },
    charge: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        charges
          .filter((row) => linked(where, row))
          .filter((row) => (where?.repeatsMonthly === undefined ? true : row.repeatsMonthly === where.repeatsMonthly))
          .filter((row) => (where && 'repeatOfId' in where ? row.repeatOfId === where.repeatOfId : true))
          .map(withRelations),
      findUnique: async ({ where }: { where: { id: string } }) => charges.find((r) => r.id === where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { repeatOfId: null, repeatMonth: null, ...data, id: `chg_${++seq}` };
        charges.push(row);
        return { id: row.id };
      },
      createMany: async ({ data }: { data: Row[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const copy of data) {
          if (charges.some((r) => r.repeatOfId === copy.repeatOfId && r.repeatMonth === copy.repeatMonth)) continue;
          charges.push({ ...copy, id: `chg_${++seq}`, repeatsMonthly: false });
          count += 1;
        }
        return { count };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(charges.find((r) => r.id === where.id)!, data);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        charges.splice(
          charges.findIndex((r) => r.id === where.id),
          1,
        );
      },
    },
    chargeCategory: {
      findUnique: async ({ where }: { where: { id: string } }) => categories.find((c) => c.id === where.id) ?? null,
      findMany: async () => categories.map((c) => ({ ...c, _count: { charges: 0 } })),
      aggregate: async () => ({ _max: { position: Math.max(...categories.map((c) => c.position as number)) } }),
      create: async ({ data }: { data: Row }) => {
        if (categories.some((c) => c.name === data.name)) {
          throw new Prisma.PrismaClientKnownRequestError('taken', { code: 'P2002', clientVersion: 'test' });
        }
        const row = { archivedAt: null, ...data, id: `cat_${++seq}` };
        categories.push(row);
        return { id: row.id };
      },
    },
    cadRate: {
      findMany: async () => rates,
      upsert: async ({ create }: { create: Row & { month: string } }) => {
        const found = rates.find((r) => r.month === create.month);
        if (found) Object.assign(found, create);
        else rates.push({ ...create, id: create.month });
      },
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], incomes, charges, categories, dossiers, requests, consultationPayments };
}

const consultant = sessionFor({ id: 'acc_stanzy', role: 'CONSULTANT' });
const member = sessionFor({ id: 'acc_1', role: 'MEMBER' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext);

const incomeOf = (extra: Record<string, unknown> = {}) => ({
  amount: 50_000,
  currency: 'XAF' as const,
  day: '2026-03-10',
  service: null,
  source: 'Formation',
  dossierId: null,
  note: null,
  ...extra,
});
const chargeOf = (extra: Record<string, unknown> = {}) => ({
  amount: 100_000,
  currency: 'XAF' as const,
  day: '2026-01-05',
  categoryId: 'cat_rent',
  dossierId: null,
  note: null,
  repeatsMonthly: false,
  ...extra,
});

describe('finances', () => {
  it('is for the consultant only', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, member).finances.overview({ year: 2026 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('counts a paid Facture as a Recette by itself, with Recettes by hand and Charges', async () => {
    const { db } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.incomes.create(incomeOf());
    await caller.finances.charges.create(chargeOf({ dossierId: 'dos_1', amount: 150_000 }));

    const { report, margins } = await caller.finances.overview({ year: 2026 });
    expect(report.total).toEqual({ income: 550_000, charges: 150_000, net: 400_000 });
    expect(report.months[1]!.income).toBe(500_000);
    expect(margins).toEqual([
      expect.objectContaining({ dossierId: 'dos_1', income: 500_000, charges: 150_000, net: 350_000 }),
    ]);
    expect(await caller.finances.dossier({ dossierId: 'dos_1' })).toMatchObject({
      income: 500_000,
      charges: 150_000,
      net: 350_000,
      unconverted: false,
    });

    const listed = await caller.finances.incomes.list({ year: 2026 });
    expect(listed.map((row) => [row.day, row.invoice?.number ?? null])).toEqual([
      ['2026-03-10', null],
      ['2026-02-20', 'STZ-2026-0002'],
      ['2026-02-03', 'STZ-2026-0001'],
    ]);
  });

  it('counts a paid Consultation as a Recette of its month, under « Consultations », not a failed one', async () => {
    const { db, consultationPayments } = fakeDatabase();
    consultationPayments.push(
      { amount: 13_500, currency: 'XAF', status: 'SUCCESS', settledAt: new Date('2026-04-12T10:00:00Z') },
      { amount: 15_000, currency: 'XAF', status: 'FAILED', settledAt: null },
    );
    const caller = callerFor(db, consultant);

    const { report, margins } = await caller.finances.overview({ year: 2026 });
    expect(report.months[3]!.income).toBe(13_500);
    expect(report.byService).toContainEqual({ service: 'CONSULTATION', income: 13_500 });
    // No Dossier: not in the margins.
    expect(margins.every((row) => row.income !== 13_500)).toBe(true);
  });

  it('lists each service sold on the Dossier with its price and its partner’s, prefilled (#158)', async () => {
    const { db } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.charges.create(chargeOf({ dossierId: 'dos_1', amount: 150_000 }));

    const finances = await caller.finances.dossier({ dossierId: 'dos_1' });
    expect(finances.lines).toEqual([
      expect.objectContaining({ kind: 'DOSSIER', price: 1_500_000, priceSource: 'CONTRACT', partnerPrice: null }),
      expect.objectContaining({
        kind: 'REQUEST',
        id: 'req_police',
        name: { fr: 'Certificat de police' },
        price: 40_000,
        priceSource: 'CATALOGUE',
        partnerPrice: 20_000,
        partnerSource: 'CATALOGUE',
      }),
    ]);
    // Factures 1 and 2 are sent (400 000 + 999 999), the Annulée doesn't count; 500 000 paid on them.
    expect(finances).toMatchObject({
      price: 1_540_000,
      partnerPrice: 20_000,
      balance: { price: 1_540_000, invoiced: 1_399_999, paid: 500_000, remaining: 1_040_000 },
      profit: 1_540_000 - 20_000 - 150_000,
    });
  });

  it('keeps the price negotiated with the Client and the partner’s, whatever the catalogue says (#158)', async () => {
    const { db, requests } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.setRequestPricing({ requestId: 'req_police', price: 25_000, partnerPrice: 15_000 });
    expect(requests[0]).toMatchObject({ agreedPrice: 25_000, partnerPrice: 15_000 });

    const { lines, profit } = await caller.finances.dossier({ dossierId: 'dos_1' });
    expect(lines[1]).toMatchObject({ price: 25_000, priceSource: 'TYPED', partnerPrice: 15_000, partnerSource: 'TYPED' });
    expect(profit).toBe(1_500_000 + 25_000 - 15_000);

    // Cleared, it goes back to the catalogue.
    await caller.finances.setRequestPricing({ requestId: 'req_police', price: null, partnerPrice: null });
    expect((await caller.finances.dossier({ dossierId: 'dos_1' })).lines[1]).toMatchObject({ priceSource: 'CATALOGUE' });

    await expect(caller.finances.setRequestPricing({ requestId: 'nope', price: 1, partnerPrice: null })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      callerFor(db, member).finances.setRequestPricing({ requestId: 'req_police', price: 1, partnerPrice: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sets the Dossier’s own service price, with no partner on it (#158)', async () => {
    const { db, dossiers } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.setDossierPricing({ dossierId: 'dos_1', price: 1_200_000 });
    expect(dossiers[0]).toMatchObject({ servicePrice: 1_200_000 });
    expect((await caller.finances.dossier({ dossierId: 'dos_1' })).lines[0]).toMatchObject({
      price: 1_200_000,
      priceSource: 'TYPED',
      partnerPrice: null,
    });
    await expect(caller.finances.setDossierPricing({ dossierId: 'nope', price: 1 })).rejects.toMatchObject({
      message: 'FINANCE_DOSSIER_UNKNOWN',
    });
  });

  it('counts CAD once the month has its rate', async () => {
    const { db } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.incomes.create(incomeOf({ currency: 'CAD', amount: 100_000 }));
    expect((await caller.finances.overview({ year: 2026 })).report.missingRates).toEqual(['2026-03']);
    const rates = await caller.finances.rates.list({ year: 2026 });
    expect(rates[2]).toEqual({ month: '2026-03', xafPerCad: null, used: true });

    await caller.finances.rates.set({ month: '2026-03', xafPerCad: 440 });
    const { report } = await caller.finances.overview({ year: 2026 });
    expect(report.missingRates).toEqual([]);
    expect(report.total.income).toBe(500_000 + 440_000);
  });

  it('refuses a Charge in an archived category, or a Dossier that doesn’t exist', async () => {
    const caller = callerFor(fakeDatabase().db, consultant);
    await expect(caller.finances.charges.create(chargeOf({ categoryId: 'cat_old' }))).rejects.toMatchObject({
      message: 'CHARGE_CATEGORY_CLOSED',
    });
    await expect(caller.finances.charges.create(chargeOf({ dossierId: 'dos_9' }))).rejects.toMatchObject({
      message: 'FINANCE_DOSSIER_UNKNOWN',
    });
  });

  it('refuses a second category with the same name', async () => {
    const caller = callerFor(fakeDatabase().db, consultant);
    await expect(caller.finances.categories.create({ name: 'Loyer' })).rejects.toMatchObject({
      message: 'CHARGE_CATEGORY_TAKEN',
    });
    await expect(caller.finances.categories.create({ name: 'Formation' })).resolves.toEqual({ id: expect.any(String) });
  });

  it('keeps a receipt that was really stored, encrypted', async () => {
    const { db, charges } = fakeDatabase();
    const caller = callerFor(db, consultant);
    storage.objectSize.mockResolvedValueOnce(1016);
    await caller.finances.charges.create(
      chargeOf({
        receipt: {
          objectKey: 'finances/receipts/abc.bin',
          key: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
          iv: 'AAAAAAAAAAAAAAAA',
          fileName: 'loyer.pdf',
          contentType: 'application/pdf',
          size: 1000,
        },
      }),
    );
    expect(charges[0]).toMatchObject({ receiptFileName: 'loyer.pdf', receiptObjectKey: 'finances/receipts/abc.bin' });
    expect(charges[0]!.receiptWrappedKey).toEqual(expect.any(String));
  });

  it('copies a monthly Charge each month, once, and a copy never repeats itself', async () => {
    const { db, charges } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.finances.charges.create(chargeOf({ repeatsMonthly: true }));

    expect(await makeMonthlyCopies(db, '2026-03-05')).toBe(2);
    expect(await makeMonthlyCopies(db, '2026-03-05')).toBe(0);
    expect(charges.map((row) => [row.repeatMonth ?? null, row.date])).toEqual([
      [null, new Date('2026-01-05T00:00:00Z')],
      ['2026-02', new Date('2026-02-05T00:00:00Z')],
      ['2026-03', new Date('2026-03-05T00:00:00Z')],
    ]);

    await expect(
      caller.finances.charges.update({ id: charges[1]!.id, charge: chargeOf({ repeatsMonthly: true }) }),
    ).rejects.toMatchObject({ message: 'CHARGE_COPY_CANNOT_REPEAT' });
  });
});
