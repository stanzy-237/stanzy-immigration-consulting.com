import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { DEFAULT_CURRENCY } from '@/features/budget/data/currencies';
import { BUDGET_LIMIT, MOTIFS } from '@/features/budget/data/motifs';
import {
  budgetAnswersSchema,
  currencySchema,
  expenseInputSchema,
  type BudgetAnswers,
  type Expense,
} from '@/features/budget/lib/budget-schema';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

type Ctx = { session: { account: { id: string } } };

/** Restricts a query to the signed-in Account's own rows. */
const ownedBy = (ctx: Ctx, id?: string) => ({
  ...(id === undefined ? {} : { id }),
  accountId: ctx.session.account.id,
});

/** A `@db.Date` column comes back as UTC midnight; send the calendar day. */
const toDay = (date: Date) => date.toISOString().slice(0, 10);
const fromDay = (day: string) => new Date(`${day}T00:00:00Z`);

const DAY_IN_MS = 86_400_000;

/**
 * The columns an add or an edit writes. The form stops dates after the User's
 * own today; the server allows one day more, since its today may be behind.
 */
const columns = (input: z.output<typeof expenseInputSchema>) => {
  if (input.date > toDay(new Date(Date.now() + DAY_IN_MS))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'BUDGET_FUTURE_DATE' });
  }
  return {
    name: input.name,
    motif: input.motif,
    amount: input.amount,
    date: fromDay(input.date),
    note: input.note ?? '',
  };
};

const isMotif = (motif: string): motif is Expense['motif'] => (MOTIFS as readonly string[]).includes(motif);

const toExpense = (row: {
  id: string;
  name: string;
  motif: string;
  amount: number;
  date: Date;
  note: string;
}): Expense => ({
  id: row.id,
  name: row.name,
  motif: isMotif(row.motif) ? row.motif : 'other',
  amount: row.amount,
  date: toDay(row.date),
  note: row.note,
});

/** A stored estimate from an older shape reads as none rather than breaking the page. */
const toEstimate = (json: unknown): BudgetAnswers | null => {
  const parsed = budgetAnswersSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
};

/**
 * The signed-in Account's budget: its currency, its Estimation de budget and
 * its Dépenses. Another Account's Dépense answers NOT_FOUND, so ids are never
 * confirmed.
 */
export const budgetRouter = createTRPCRouter({
  profile: createTRPCRouter({
    /** The Account's currency and saved estimate, or null before either was set. */
    get: protectedProcedure.query(async ({ ctx }) => {
      const row = await ctx.prisma.budgetProfile.findUnique({ where: { accountId: ctx.session.account.id } });
      if (!row) return null;
      return {
        currency: currencySchema.catch(DEFAULT_CURRENCY).parse(row.currency),
        estimate: toEstimate(row.estimate),
      };
    }),

    /** Amounts already logged keep their numbers: nothing is converted. */
    setCurrency: protectedProcedure
      .input(z.object({ currency: currencySchema }))
      .mutation(async ({ ctx, input }) => {
        const accountId = ctx.session.account.id;
        await ctx.prisma.budgetProfile.upsert({
          where: { accountId },
          create: { accountId, currency: input.currency },
          update: { currency: input.currency },
        });
      }),

    /** A first save also sets the Account's currency to the estimate's. */
    saveEstimate: protectedProcedure
      .input(z.object({ estimate: budgetAnswersSchema }))
      .mutation(async ({ ctx, input }) => {
        const accountId = ctx.session.account.id;
        await ctx.prisma.budgetProfile.upsert({
          where: { accountId },
          create: { accountId, currency: input.estimate.currency, estimate: input.estimate },
          update: { estimate: input.estimate },
        });
      }),
  }),

  expenses: createTRPCRouter({
    /** The Account's Dépenses, newest first. */
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.prisma.budgetExpense.findMany({
        where: ownedBy(ctx),
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map(toExpense);
    }),

    /** Refuses with BUDGET_LIMIT once the Account holds BUDGET_LIMIT Dépenses. */
    add: protectedProcedure.input(expenseInputSchema).mutation(async ({ ctx, input }) => {
      const data = columns(input);
      if ((await ctx.prisma.budgetExpense.count({ where: ownedBy(ctx) })) >= BUDGET_LIMIT) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'BUDGET_LIMIT' });
      }
      const row = await ctx.prisma.budgetExpense.create({
        data: { accountId: ctx.session.account.id, ...data },
      });
      return toExpense(row);
    }),

    update: protectedProcedure
      .input(expenseInputSchema.extend(byId.shape))
      .mutation(async ({ ctx, input }) => {
        const { count } = await ctx.prisma.budgetExpense.updateMany({
          where: ownedBy(ctx, input.id),
          data: columns(input),
        });
        if (count === 0) throw notFound();
        const row = await ctx.prisma.budgetExpense.findFirst({ where: ownedBy(ctx, input.id) });
        if (!row) throw notFound();
        return toExpense(row);
      }),

    delete: protectedProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.budgetExpense.deleteMany({ where: ownedBy(ctx, input.id) });
      if (count === 0) throw notFound();
    }),
  }),
});
