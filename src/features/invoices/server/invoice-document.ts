import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { renderInvoicePdf } from '@/features/invoices/lib/invoice-pdf';
import type { InvoiceStatus } from '@/features/invoices/lib/invoice-status';
import type { Currency } from '@/features/invoices/lib/money';
import type { ImageFile } from '@/features/signatures/lib/sign-pdf';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

// Shipped with the server bundle through `outputFileTracingIncludes` (next.config.ts).
const LETTERHEAD = join(process.cwd(), 'src/features/invoices/assets/letterhead.pdf');
let letterhead: Promise<Buffer> | null = null;

/** A sent Facture, as the PDF prints it. */
export type InvoiceForPdf = {
  number: string;
  status: InvoiceStatus;
  sentAt: Date;
  dueDate: Date | null;
  currency: Currency;
  notes: string | null;
  lines: { description: string; quantity: number; unitAmount: number }[];
  dossier: { service: ServiceType; account: { name: string; email: string; locale: string } };
};

/**
 * The Facture's PDF on the Stanzy letterhead, in the Client's language,
 * stamped once Payée or Annulée; a Payée one carries `consultant`'s
 * signature and the company stamp (#145).
 */
export async function invoicePdf(
  invoice: InvoiceForPdf,
  consultant: { signature: ImageFile; stamp: ImageFile } | null = null,
): Promise<Buffer> {
  letterhead ??= readFile(LETTERHEAD);
  const locale = toLocale(invoice.dossier.account.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const bytes = await renderInvoicePdf(await letterhead, {
    locale,
    number: invoice.number,
    issuedOn: invoice.sentAt,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    client: { name: invoice.dossier.account.name, email: invoice.dossier.account.email },
    service: t(`Dossiers.services.${invoice.dossier.service}`),
    lines: invoice.lines,
    notes: invoice.notes,
    stamp: invoice.status === 'PAID' ? 'PAID' : invoice.status === 'CANCELLED' ? 'CANCELLED' : null,
    consultant,
    labels: {
      title: t('Invoices.pdf.title'),
      number: t('Invoices.pdf.number'),
      issuedOn: t('Invoices.pdf.issuedOn'),
      dueDate: t('Invoices.pdf.dueDate'),
      billedTo: t('Invoices.pdf.billedTo'),
      dossier: t('Invoices.pdf.dossier'),
      description: t('Invoices.pdf.description'),
      quantity: t('Invoices.pdf.quantity'),
      unitPrice: t('Invoices.pdf.unitPrice'),
      amount: t('Invoices.pdf.amount'),
      total: t('Invoices.pdf.total'),
      notes: t('Invoices.pdf.notes'),
      page: (page, pages) => t('Invoices.pdf.page', { page, pages }),
      paid: t('Invoices.status.PAID'),
      cancelled: t('Invoices.status.CANCELLED'),
      company: t('Invoices.receipt.company'),
    },
  });
  return Buffer.from(bytes);
}
