import { z } from 'zod';

import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import { CURRENCIES } from '@/features/invoices/lib/money';

export const LINE_DESCRIPTION_MAX = 200;
export const NOTES_MAX = 1000;
export const LINES_MAX = 30;
export const CANCEL_REASON_MAX = 500;

const id = z.string().min(1);

export const invoiceLineInput = z.object({
  description: z.string().trim().min(1).max(LINE_DESCRIPTION_MAX),
  quantity: z.number().int().min(1).max(999),
  /** In the currency's minor unit. */
  unitAmount: z.number().int().min(0).max(100_000_000_000),
});

/** A draft, new (no `id`) or edited; its lines replace the saved ones. */
export const saveInvoiceInput = z.object({
  id: id.optional(),
  dossierId: id,
  currency: z.enum(CURRENCIES),
  dueDate: z.date().nullable(),
  notes: z.string().trim().max(NOTES_MAX),
  lines: z.array(invoiceLineInput).min(1).max(LINES_MAX),
});
export type SaveInvoiceInput = z.infer<typeof saveInvoiceInput>;

export const INVOICE_FILTERS = ['ALL', 'DRAFT', 'AWAITING', 'OVERDUE', 'PAID', 'CANCELLED'] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];
export const invoiceListInput = z.object({ filter: z.enum(INVOICE_FILTERS) });

export const dossierSearchInput = z.object({ query: z.string().trim().min(2).max(100) });

export const cancelInvoiceInput = z.object({ id, reason: z.string().trim().min(3).max(CANCEL_REASON_MAX) });

/** Where a Facture's encrypted Preuves de paiement live in the private R2 bucket (#87). */
export const invoiceFilePrefix = (invoiceId: string): string => `invoices/${invoiceId}/`;

/** How a Paiement was made, in the order a Reconnaissance lists them (#145). */
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'BANK_DEPOSIT', 'MOBILE_MONEY', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_NOTE_MAX = 120;

/**
 * A Paiement the consultant records (#145): how much (minor units), the day,
 * how (« Autre » says what), and optionally a justificatif the browser
 * already encrypted and sent (a cash receipt).
 */
export const recordPaymentInput = z
  .object({
    invoiceId: id,
    amount: z.number().int().positive(),
    receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    method: z.enum(PAYMENT_METHODS),
    methodNote: z.string().trim().max(PAYMENT_NOTE_MAX).nullable(),
    proof: encryptedFileInput.extend({ invoiceId: id }).optional(),
  })
  .refine((input) => input.method !== 'OTHER' || Boolean(input.methodNote), { path: ['methodNote'], message: 'PAYMENT_NOTE_REQUIRED' });

/** REC-2026-0001 */
export const receiptNumber = (year: number, sequence: number): string => `REC-${year}-${String(sequence).padStart(4, '0')}`;
