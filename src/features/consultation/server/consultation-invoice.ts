import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';

import { money } from '@/features/consultation/lib/money';
import type { Db } from '@/features/consultation/server/booking-calendar';
import { renderInvoicePdf } from '@/features/invoices/lib/invoice-pdf';
import { meetingWhen } from '@/features/meetings/lib/meeting-emails';
import { openSigningAssets } from '@/features/signatures/server/signing-assets';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

// The same letterhead as the Dossiers' Factures (shipped through `outputFileTracingIncludes`).
const LETTERHEAD = join(process.cwd(), 'src/features/invoices/assets/letterhead.pdf');
let letterhead: Promise<Buffer> | null = null;

/**
 * The Facture payée of a Consultation (#15): issued when SasPay said
 * `SUCCESS`, numbered with the Dossiers' Factures, on the Stanzy letterhead,
 * stamped « Payée » and signed like them. One line for the Consultation (its
 * slot, heure de Douala), one for the Code promo's reduction; the notes say
 * how it was paid, SasPay's fees on top. In the Client's language. Null until
 * the payment succeeded.
 */
export async function consultationInvoice(prisma: Db, paymentId: string): Promise<{ number: string; pdf: Buffer } | null> {
  const payment = await prisma.consultationPayment.findUnique({
    where: { id: paymentId },
    include: {
      promoCode: { select: { code: true } },
      consultation: { select: { startsAt: true, durationMinutes: true, account: { select: { name: true, email: true, locale: true } } } },
    },
  });
  if (!payment || payment.status !== 'SUCCESS' || !payment.invoiceNumber) return null;

  const { consultation } = payment;
  const locale = toLocale(consultation.account.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const intl = locale === 'fr' ? 'fr-FR' : 'en-CA';
  const paidOn = payment.settledAt ?? payment.updatedAt;
  const charged = payment.charged === null ? null : Number(payment.charged);
  const fee = payment.fee === null ? null : Number(payment.fee);
  const currency = payment.settledCurrency ?? payment.currency;
  const how = payment.network === 'card' ? t('Consultation.invoice.card') : [payment.networkName, payment.phone].filter(Boolean).join(' · ');

  const notes = [
    t('Consultation.invoice.paid', { how, date: meetingWhen(paidOn, locale) }),
    charged !== null && fee !== null ? t('Consultation.invoice.fees', { charged: money(charged, currency, intl), fee: money(fee, currency, intl) }) : null,
    t('Consultation.invoice.noRefund'),
  ]
    .filter(Boolean)
    .join('\n');

  letterhead ??= readFile(LETTERHEAD);
  const bytes = await renderInvoicePdf(await letterhead, {
    locale,
    number: payment.invoiceNumber,
    issuedOn: paidOn,
    dueDate: null,
    // FCFA: XAF and XOF are the same value; the Factures print XAF.
    currency: 'XAF',
    client: { name: consultation.account.name, email: consultation.account.email },
    service: t('Consultation.invoice.service'),
    lines: [
      {
        description: t('Consultation.invoice.line', { minutes: consultation.durationMinutes, when: meetingWhen(consultation.startsAt, locale) }),
        quantity: 1,
        unitAmount: payment.amount + payment.discount,
      },
      ...(payment.discount > 0
        ? [{ description: t('Consultation.invoice.promo', { code: payment.promoCode?.code ?? '' }), quantity: 1, unitAmount: -payment.discount }]
        : []),
    ],
    notes,
    balance: null,
    stamp: 'PAID',
    consultant: await openSigningAssets(prisma),
    labels: {
      title: t('Invoices.pdf.title'),
      number: t('Invoices.pdf.number'),
      issuedOn: t('Invoices.pdf.issuedOn'),
      dueDate: t('Invoices.pdf.dueDate'),
      billedTo: t('Invoices.pdf.billedTo'),
      dossier: t('Consultation.invoice.serviceLabel'),
      description: t('Invoices.pdf.description'),
      quantity: t('Invoices.pdf.quantity'),
      unitPrice: t('Invoices.pdf.unitPrice'),
      amount: t('Invoices.pdf.amount'),
      total: t('Invoices.pdf.total'),
      notes: t('Invoices.pdf.notes'),
      servicePrice: t('Invoices.pdf.servicePrice'),
      earlier: t('Invoices.pdf.earlier'),
      remaining: t('Invoices.pdf.remaining'),
      page: (page, pages) => t('Invoices.pdf.page', { page, pages }),
      paid: t('Invoices.status.PAID'),
      cancelled: t('Invoices.status.CANCELLED'),
      company: t('Invoices.receipt.company'),
    },
  });
  return { number: payment.invoiceNumber, pdf: Buffer.from(bytes) };
}
