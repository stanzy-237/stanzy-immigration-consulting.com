import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { dossierMargins, toXaf, yearReport, monthOf } from '@/features/finances/lib/finance-report';
import {
  archiveCategoryInput,
  categoryInput,
  chargeInput,
  incomeInput,
  RECEIPT_PREFIX,
  rateInput,
  renameCategoryInput,
  updateChargeInput,
  updateIncomeInput,
  yearInput,
  monthInput,
  type ChargeInput,
  type IncomeInput,
} from '@/features/finances/lib/finance-schema';
import { dateOf, dayOf, loadEntries, loadRates } from '@/features/finances/server/finance-entries';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { invoiceTotal } from '@/features/invoices/lib/money';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

const isTaken = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const dossierShown = { select: { id: true, service: true, account: { select: { name: true, email: true } } } } as const;

/** A Dossier to link to must exist; null unlinks. */
async function linkable(db: Db, dossierId: string | null): Promise<string | null> {
  if (dossierId === null) return null;
  const dossier = await db.dossier.findUnique({ where: { id: dossierId }, select: { id: true } });
  if (!dossier) throw refuse('FINANCE_DOSSIER_UNKNOWN');
  return dossier.id;
}

const incomeData = async (db: Db, input: IncomeInput) => ({
  amount: input.amount,
  currency: input.currency,
  date: dateOf(input.day),
  service: input.service,
  source: input.service ? null : input.source,
  dossierId: await linkable(db, input.dossierId),
  note: input.note || null,
});

/** A Charge's fields, its category open (or the one it already has). */
async function chargeData(db: Db, input: ChargeInput, currentCategoryId?: string) {
  const category = await db.chargeCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, archivedAt: true },
  });
  if (!category || (category.archivedAt && category.id !== currentCategoryId)) refuseCategory();
  return {
    amount: input.amount,
    currency: input.currency,
    date: dateOf(input.day),
    categoryId: input.categoryId,
    dossierId: await linkable(db, input.dossierId),
    note: input.note || null,
  };
}

function refuseCategory(): never {
  throw refuse('CHARGE_CATEGORY_CLOSED');
}

/** The receipt's columns from a new encrypted upload, or all null to take it off. */
async function receiptData(receipt: ChargeInput['receipt']) {
  if (!receipt) {
    return {
      receiptFileName: null,
      receiptContentType: null,
      receiptSize: null,
      receiptObjectKey: null,
      receiptWrappedKey: null,
      receiptIv: null,
    };
  }
  return {
    receiptFileName: receipt.fileName,
    receiptContentType: receipt.contentType,
    receiptSize: receipt.size,
    receiptObjectKey: receipt.objectKey,
    receiptWrappedKey: await acceptEncryptedUpload(receipt, RECEIPT_PREFIX),
    receiptIv: receipt.iv,
  };
}

/** Finances (#95): the consultant's Recettes and Charges, in XAF. Nobody else reaches it. */
export const financesRouter = createTRPCRouter({
  /** The year in XAF: per month, service and category; and each Dossier's margin, all time. */
  overview: consultantProcedure.input(yearInput).query(async ({ ctx, input }) => {
    const [entries, linked, rates] = await Promise.all([
      loadEntries(ctx.prisma, { year: input.year }),
      loadEntries(ctx.prisma, { dossiers: true }),
      loadRates(ctx.prisma),
    ]);
    const margins = dossierMargins(linked, rates);
    const dossiers = await ctx.prisma.dossier.findMany({
      where: { id: { in: margins.map((margin) => margin.dossierId) } },
      select: dossierShown.select,
    });
    const named = new Map(dossiers.map((dossier) => [dossier.id, dossier]));
    return {
      report: yearReport(entries, rates, input.year),
      margins: margins.flatMap((margin) => {
        const dossier = named.get(margin.dossierId);
        return dossier ? [{ ...margin, dossier }] : [];
      }),
    };
  }),

  /** What one Dossier brought in and cost, for its page. */
  dossier: consultantProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const [entries, rates] = await Promise.all([
      loadEntries(ctx.prisma, { dossierId: input.dossierId }),
      loadRates(ctx.prisma),
    ]);
    const [margin] = dossierMargins(entries, rates);
    const unconverted = entries.some((entry) => toXaf(entry.amount, entry.currency, monthOf(entry.day), rates) === null);
    return { income: margin?.income ?? 0, charges: margin?.charges ?? 0, net: margin?.net ?? 0, unconverted };
  }),

  incomes: createTRPCRouter({
    /** The year's Recettes: by hand (editable) and paid Factures (read only), newest first. */
    list: consultantProcedure.input(yearInput).query(async ({ ctx, input }) => {
      const days = { gte: dateOf(`${input.year}-01-01`), lt: dateOf(`${input.year + 1}-01-01`) };
      const [incomes, invoices] = await Promise.all([
        ctx.prisma.income.findMany({
          where: { date: days },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            amount: true,
            currency: true,
            date: true,
            service: true,
            source: true,
            note: true,
            dossier: dossierShown,
          },
        }),
        ctx.prisma.invoice.findMany({
          where: {
            status: 'PAID',
            paidAt: {
              gte: new Date(`${input.year}-01-01T00:00:00+01:00`),
              lt: new Date(`${input.year + 1}-01-01T00:00:00+01:00`),
            },
          },
          orderBy: { paidAt: 'desc' },
          select: {
            id: true,
            number: true,
            currency: true,
            paidAt: true,
            lines: { select: { quantity: true, unitAmount: true } },
            dossier: dossierShown,
          },
        }),
      ]);
      return [
        ...incomes.map((income) => ({ ...income, day: dayOf(income.date), invoice: null })),
        ...invoices.map((invoice) => ({
          id: invoice.id,
          amount: invoiceTotal(invoice.lines),
          currency: invoice.currency,
          day: doualaDay(invoice.paidAt!),
          service: invoice.dossier.service,
          source: null,
          note: null,
          dossier: invoice.dossier,
          invoice: { id: invoice.id, number: invoice.number ?? '' },
        })),
      ].sort((a, b) => b.day.localeCompare(a.day));
    }),

    create: consultantProcedure.input(incomeInput).mutation(async ({ ctx, input }) =>
      ctx.prisma.income.create({
        data: { ...(await incomeData(ctx.prisma, input)), createdById: ctx.session.account.id },
        select: { id: true },
      }),
    ),

    update: consultantProcedure.input(updateIncomeInput).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.income.updateMany({
        where: { id: input.id },
        data: await incomeData(ctx.prisma, input.income),
      });
      if (count === 0) throw notFound();
    }),

    delete: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.income.deleteMany({ where: { id: input.id } });
      if (count === 0) throw notFound();
    }),
  }),

  charges: createTRPCRouter({
    /** The year's Charges, newest first. */
    list: consultantProcedure.input(yearInput).query(async ({ ctx, input }) => {
      const charges = await ctx.prisma.charge.findMany({
        where: { date: { gte: dateOf(`${input.year}-01-01`), lt: dateOf(`${input.year + 1}-01-01`) } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          amount: true,
          currency: true,
          date: true,
          note: true,
          repeatsMonthly: true,
          repeatOfId: true,
          receiptFileName: true,
          category: { select: { id: true, name: true } },
          dossier: dossierShown,
        },
      });
      return charges.map(({ date, ...charge }) => ({ ...charge, day: dayOf(date) }));
    }),

    create: consultantProcedure.input(chargeInput).mutation(async ({ ctx, input }) =>
      ctx.prisma.charge.create({
        data: {
          ...(await chargeData(ctx.prisma, input)),
          repeatsMonthly: input.repeatsMonthly,
          ...(input.receipt ? await receiptData(input.receipt) : {}),
          createdById: ctx.session.account.id,
        },
        select: { id: true },
      }),
    ),

    /**
     * Edits a Charge. Only a model repeats: a monthly copy can't start
     * repeating itself. A new or removed receipt deletes the old file.
     */
    update: consultantProcedure.input(updateChargeInput).mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.charge.findUnique({
        where: { id: input.id },
        select: { categoryId: true, repeatOfId: true, receiptObjectKey: true },
      });
      if (!current) throw notFound();
      if (input.charge.repeatsMonthly && current.repeatOfId) throw refuse('CHARGE_COPY_CANNOT_REPEAT');
      const receiptChanged = input.charge.receipt !== undefined;
      await ctx.prisma.charge.update({
        where: { id: input.id },
        data: {
          ...(await chargeData(ctx.prisma, input.charge, current.categoryId)),
          repeatsMonthly: input.charge.repeatsMonthly,
          ...(receiptChanged ? await receiptData(input.charge.receipt) : {}),
        },
      });
      if (receiptChanged && current.receiptObjectKey) await deleteFiles([current.receiptObjectKey]).catch(() => {});
    }),

    /** Deletes a Charge and its receipt; its monthly copies stay (they happened). */
    delete: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const charge = await ctx.prisma.charge.findUnique({
        where: { id: input.id },
        select: { receiptObjectKey: true },
      });
      if (!charge) throw notFound();
      await ctx.prisma.charge.delete({ where: { id: input.id } });
      if (charge.receiptObjectKey) await deleteFiles([charge.receiptObjectKey]).catch(() => {});
    }),
  }),

  categories: createTRPCRouter({
    /** Open categories first, in the consultant's order; archived ones after. */
    list: consultantProcedure.query(({ ctx }) =>
      ctx.prisma.chargeCategory.findMany({
        orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { position: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, archivedAt: true, _count: { select: { charges: true } } },
      }),
    ),

    create: consultantProcedure.input(categoryInput).mutation(async ({ ctx, input }) => {
      const last = await ctx.prisma.chargeCategory.aggregate({ _max: { position: true } });
      try {
        return await ctx.prisma.chargeCategory.create({
          data: { name: input.name, position: (last._max.position ?? 0) + 1 },
          select: { id: true },
        });
      } catch (error) {
        if (isTaken(error)) throw refuse('CHARGE_CATEGORY_TAKEN');
        throw error;
      }
    }),

    rename: consultantProcedure.input(renameCategoryInput).mutation(async ({ ctx, input }) => {
      try {
        const { count } = await ctx.prisma.chargeCategory.updateMany({
          where: { id: input.id },
          data: { name: input.name },
        });
        if (count === 0) throw notFound();
      } catch (error) {
        if (isTaken(error)) throw refuse('CHARGE_CATEGORY_TAKEN');
        throw error;
      }
    }),

    /** Archived: kept on its Charges, no longer offered. Restored the same way. */
    archive: consultantProcedure.input(archiveCategoryInput).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.chargeCategory.updateMany({
        where: { id: input.id },
        data: { archivedAt: input.archived ? new Date() : null },
      });
      if (count === 0) throw notFound();
    }),
  }),

  rates: createTRPCRouter({
    /** The year's twelve months: the CAD rate entered, and whether CAD amounts need it. */
    list: consultantProcedure.input(yearInput).query(async ({ ctx, input }) => {
      const [rates, entries] = await Promise.all([loadRates(ctx.prisma), loadEntries(ctx.prisma, { year: input.year })]);
      const used = new Set(entries.filter((entry) => entry.currency === 'CAD').map((entry) => monthOf(entry.day)));
      return Array.from({ length: 12 }, (_, index) => {
        const month = `${input.year}-${String(index + 1).padStart(2, '0')}`;
        return { month, xafPerCad: rates[month] ?? null, used: used.has(month) };
      });
    }),

    set: consultantProcedure.input(rateInput).mutation(async ({ ctx, input }) => {
      await ctx.prisma.cadRate.upsert({
        where: { month: input.month },
        create: { month: input.month, xafPerCad: input.xafPerCad },
        update: { xafPerCad: input.xafPerCad },
      });
    }),

    clear: consultantProcedure.input(z.object({ month: monthInput })).mutation(async ({ ctx, input }) => {
      await ctx.prisma.cadRate.deleteMany({ where: { month: input.month } });
    }),
  }),
});
