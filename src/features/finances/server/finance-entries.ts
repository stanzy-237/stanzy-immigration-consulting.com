import type { Prisma } from '@prisma/client';

import type { CadRates, Entry } from '@/features/finances/lib/finance-report';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** A `@db.Date` column as `YYYY-MM-DD`. */
export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
/** `YYYY-MM-DD` as a `@db.Date` value. */
export const dateOf = (day: string): Date => new Date(`${day}T00:00:00Z`);

/** The year's bounds: `YYYY-MM-DD` text for a Paiement's day, `@db.Date` values for dates. */
export const yearBounds = (year: number) => ({
  received: { gte: `${year}-01-01`, lt: `${year + 1}-01-01` },
  days: { gte: dateOf(`${year}-01-01`), lt: dateOf(`${year + 1}-01-01`) },
});

/** The Paiements counted as Recettes: those on a Facture still standing (not Annulée). */
export const countedPayments = (dossierId?: string): Prisma.PaymentWhereInput['invoice'] => ({
  status: { not: 'CANCELLED' },
  ...(dossierId ? { dossierId } : {}),
});

/**
 * Every Recette and Charge as the reports read them: each Paiement on a
 * Facture (a Recette by itself, on the day it was received, #145),
 * Recettes by hand and Charges. `year` narrows to one year; `dossiers`
 * keeps only those linked to a Dossier (for margins, all time).
 */
export async function loadEntries(db: Db, scope: { year: number } | { dossiers: true } | { dossierId: string }): Promise<Entry[]> {
  const bounds = 'year' in scope ? yearBounds(scope.year) : null;
  const linked: Prisma.IncomeWhereInput & Prisma.ChargeWhereInput =
    'dossierId' in scope ? { dossierId: scope.dossierId } : 'dossiers' in scope ? { dossierId: { not: null } } : {};

  const [payments, incomes, charges] = await Promise.all([
    db.payment.findMany({
      where: {
        invoice: countedPayments('dossierId' in scope ? scope.dossierId : undefined),
        ...(bounds ? { receivedOn: bounds.received } : {}),
      },
      select: {
        amount: true,
        receivedOn: true,
        invoice: { select: { currency: true, dossierId: true, dossier: { select: { service: true } } } },
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
    ...payments.map(
      ({ invoice, ...payment }): Entry => ({
        kind: 'income',
        day: payment.receivedOn,
        amount: payment.amount,
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
