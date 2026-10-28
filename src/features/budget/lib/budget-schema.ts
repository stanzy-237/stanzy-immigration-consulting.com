import { z } from 'zod';

import { CURRENCIES, DEFAULT_CURRENCY } from '@/features/budget/data/currencies';
import { EDITABLE_LINES, LANGUAGE_TESTS } from '@/features/budget/data/fees';
import { MOTIFS } from '@/features/budget/data/motifs';

export const currencySchema = z.enum(CURRENCIES);

/** A price the User typed for one estimated line, per person, in the currency they typed it in. */
const linePriceSchema = z.object({
  amount: z.number().min(0).max(1_000_000_000),
  currency: currencySchema,
});

/**
 * An Estimation de budget: the estimator's answers, the lines the User edited
 * and the rate they set. Shared by the browser copy and the Account's copy.
 */
export const budgetAnswersSchema = z.object({
  /** A spouse or partner applies with the principal applicant. */
  spouse: z.boolean(),
  /** Dependent children applying too. */
  children: z.number().int().min(0).max(10),
  /** The principal applicant's language test, or `none` when already taken. */
  test: z.enum([...LANGUAGE_TESTS, 'none']),
  spouseTest: z.boolean(),
  ecaPrincipal: z.boolean(),
  ecaSpouse: z.boolean(),
  /** CEC candidates and holders of a valid job offer need not prove funds. */
  fundsExempt: z.boolean(),
  /**
   * The ITA is in: language tests and diploma evaluations, which come
   * before it, are behind the User and leave the estimate. Estimates kept
   * before it existed have none: they read as false.
   */
  itaReceived: z.boolean().catch(false),
  currency: currencySchema,
  /** Units of `currency` for 1 CAD, when the User replaced the default. */
  rate: z.number().positive().max(1_000_000).nullable(),
  lines: z.object(
    Object.fromEntries(EDITABLE_LINES.map((key) => [key, linePriceSchema.optional()])) as Record<
      (typeof EDITABLE_LINES)[number],
      z.ZodOptional<typeof linePriceSchema>
    >,
  ),
});

export type BudgetAnswers = z.infer<typeof budgetAnswersSchema>;

/** A single applicant who still has to take a TEF and get a WES ECA. */
export const DEFAULT_ANSWERS: BudgetAnswers = {
  spouse: false,
  children: 0,
  test: 'TEF',
  spouseTest: false,
  ecaPrincipal: true,
  ecaSpouse: false,
  fundsExempt: false,
  itaReceived: false,
  currency: DEFAULT_CURRENCY,
  rate: null,
  lines: {},
};

/** A calendar day, `YYYY-MM-DD`. */
const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The most Dépenses one Account can log. */
export const BUDGET_LIMIT = 500;

/** The largest amount one Dépense may hold, in minor units. */
export const MAX_EXPENSE_AMOUNT = 1_000_000_000;

/** What the form sends for one Dépense; `amount` is in the currency's minor units. */
export const expenseInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  motif: z.enum(MOTIFS),
  amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
  date: calendarDay,
  note: z.string().trim().max(500).optional(),
});

export type ExpenseInput = z.input<typeof expenseInputSchema>;

/** One Dépense as the client reads it. */
export type Expense = {
  id: string;
  name: string;
  motif: (typeof MOTIFS)[number];
  amount: number;
  date: string;
  note: string;
};
