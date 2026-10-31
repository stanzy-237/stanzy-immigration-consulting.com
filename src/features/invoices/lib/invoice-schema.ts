import { z } from 'zod';

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

export const invoiceBlobPrefix = (invoiceId: string): string => `invoices/${invoiceId}/`;
