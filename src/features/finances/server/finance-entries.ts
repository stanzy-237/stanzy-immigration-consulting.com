import type { Prisma } from '@prisma/client';

import { doualaDay } from '@/features/notifications/lib/douala-days';
import type { CadRates, Entry } from '@/features/finances/lib/finance-report';
import { invoiceTotal } from '@/features/invoices/lib/money';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** A `@db.Date` column as `YYYY-MM-DD`. */
export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
/** `YYYY-MM-DD` as a `@db.Date` value. */
export const dateOf = (day: string): Date => new Date(`${day}T00:00:00Z`);

/** The year's bounds: Douala time for a payment's moment, plain days for dates. */
const yearBounds = (year: number) => ({
  moments: { gte: new Date(`${year}-01-01T00:00:00+01:00`), lt: new Date(`${year + 1}-01-01T00:00:00+01:00`) },
  days: { gte: dateOf(`${year}-01-01`), lt: dateOf(`${year + 1}-01-01`) },
});

/**
 * Every Recette and Charge as the reports read them: paid Factures (a
 * Recette by themselves, on the day they were marked Payée, in Douala),
 * Recettes by hand and Charges. `year` narrows to one year; `dossiers`
 * keeps only those linked to a Dossier (for margins, all time).
 */
export async function loadEntries(db: Db, scope: { year: number } | { dossiers: true } | { dossierId: string }): Promise<Entry[]> {
  const bounds = 'year' in scope ? yearBounds(scope.year) : null;
  const linked: Prisma.IncomeWhereInput & Prisma.ChargeWhereInput =
    'dossierId' in scope ? { dossierId: scope.dossierId } : 'dossiers' in scope ? { dossierId: { not: null } } : {};

  const [invoices, incomes, charges] = await Promise.all([
    db.invoice.findMany({
      where: {
        status: 'PAID',
        ...(bounds ? { paidAt: bounds.moments } : {}),
        ...('dossierId' in scope ? { dossierId: scope.dossierId } : {}),
      },
      select: {
        currency: true,
        paidAt: true,
        dossierId: true,
        dossier: { select: { service: true } },
        lines: { select: { quantity: true, unitAmount: true } },
      },
    }),
    db.income.findMany({
      where: { ...linked, ...(bounds ? { date: bounds.days } : {}) },
      select: { amount: true, currency: true, date: true, service: true, dossierId: true },
    }),
    db.charge.findMany({
      where: { ...linked, ...(bounds ? { date: bounds.days } : {}) },
      select: { amount: true, currency: true, date: true, dossierId: true, category: { select: { name: true } } },
    }),
  ]);

  return [
    ...invoices.map(
      (invoice): Entry => ({
        kind: 'income',
        day: doualaDay(invoice.paidAt!),
        amount: invoiceTotal(invoice.lines),
        currency: invoice.currency,
        service: invoice.dossier.service,
        dossierId: invoice.dossierId,
      }),
    ),
    ...incomes.map(
      (income): Entry => ({
        kind: 'income',
        day: dayOf(income.date),
        amount: income.amount,
        currency: income.currency,
        service: income.service,
        dossierId: income.dossierId,
      }),
    ),
    ...charges.map(
      (charge): Entry => ({
        kind: 'charge',
        day: dayOf(charge.date),
        amount: charge.amount,
        currency: charge.currency,
        category: charge.category.name,
        dossierId: charge.dossierId,
      }),
    ),
  ];
}

/** Every CAD rate entered, by month. */
export async function loadRates(db: Db): Promise<CadRates> {
  const rows = await db.cadRate.findMany({ select: { month: true, xafPerCad: true } });
  return Object.fromEntries(rows.map((row) => [row.month, Number(row.xafPerCad)]));
}
