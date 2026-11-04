import { z } from 'zod';

import { SERVICE_TYPES } from '@/features/dossiers/data/workflows';
import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import { CURRENCIES } from '@/features/invoices/lib/money';

export const NOTE_MAX = 500;
export const SOURCE_MAX = 120;
export const CATEGORY_MAX = 60;

const id = z.string().min(1);

/** A calendar day, `YYYY-MM-DD`, that exists. */
export const dayInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const date = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
  }, 'Not a day');

/** A month, `YYYY-MM`. */
export const monthInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const yearInput = z.object({ year: z.number().int().min(2020).max(2100) });

const amount = z.number().int().min(1).max(100_000_000_000);
const note = z.string().trim().max(NOTE_MAX).nullable();

/** A Recette by hand: for a service, or from a source named otherwise. */
export const incomeInput = z
  .object({
    amount,
    currency: z.enum(CURRENCIES),
    day: dayInput,
    service: z.enum(SERVICE_TYPES).nullable(),
    source: z.string().trim().max(SOURCE_MAX).nullable(),
    dossierId: id.nullable(),
    note,
  })
  .refine((income) => income.service !== null || (income.source ?? '').length > 0, {
    message: 'INCOME_SOURCE_MISSING',
    path: ['source'],
  });
export type IncomeInput = z.infer<typeof incomeInput>;
export const updateIncomeInput = z.object({ id, income: incomeInput });

/**
 * A Charge. `receipt`: a new encrypted file; null takes the old one off;
 * left out (on an edit) keeps it.
 */
export const chargeInput = z.object({
  amount,
  currency: z.enum(CURRENCIES),
  day: dayInput,
  categoryId: id,
  dossierId: id.nullable(),
  note,
  repeatsMonthly: z.boolean(),
  receipt: encryptedFileInput.nullable().optional(),
});
export type ChargeInput = z.infer<typeof chargeInput>;
export const updateChargeInput = z.object({ id, charge: chargeInput });

export const categoryInput = z.object({ name: z.string().trim().min(2).max(CATEGORY_MAX) });
export const renameCategoryInput = categoryInput.extend({ id });
export const archiveCategoryInput = z.object({ id, archived: z.boolean() });

/** XAF for 1 CAD in a month. */
export const rateInput = z.object({ month: monthInput, xafPerCad: z.number().positive().max(100_000) });

/** Where Charges' encrypted receipts live in the private R2 bucket. */
export const RECEIPT_PREFIX = 'finances/receipts/';
