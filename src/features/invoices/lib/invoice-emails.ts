import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { formatMoney, type Currency } from '@/features/invoices/lib/money';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

type InvoiceFacts = { number: string; total: number; currency: Currency; dueDate: Date | null; service: ServiceType };

function translator(locale: unknown) {
  const resolved = toLocale(locale);
  return { locale: resolved, t: createTranslator({ locale: resolved, messages: MESSAGES[resolved] }) };
}

/** The Facture's PDF, attached, with the amount and due date in the body; the button opens « Mon espace ». */
export function invoiceSentEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  invoice: InvoiceFacts;
  pdf: Buffer;
  url: string;
}): EmailMessage {
  const { locale, t } = translator(opts.locale);
  const { invoice } = opts;
  const total = formatMoney(invoice.total, invoice.currency, locale);
  const service = t(`Dossiers.services.${invoice.service}`);
  const due = invoice.dueDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        invoice.dueDate,
      )
    : null;
  return {
    ...renderEmail({
      to: opts.to,
      subject: t('Invoices.emails.sent.subject', { number: invoice.number }),
      lines: [
        t('Dossiers.emails.greeting', { name: opts.name }),
        due
          ? t('Invoices.emails.sent.bodyDue', { number: invoice.number, service, total, due })
          : t('Invoices.emails.sent.body', { number: invoice.number, service, total }),
        t('Invoices.emails.sent.proof'),
      ],
      cta: t('Dossiers.emails.cta'),
      url: opts.url,
    }),
    attachments: [{ filename: `${invoice.number}.pdf`, content: opts.pdf }],
  };
}

/** Confirms the consultant marked the Facture Payée. */
export function invoicePaidEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  invoice: InvoiceFacts;
  url: string;
}): EmailMessage {
  const { locale, t } = translator(opts.locale);
  const { invoice } = opts;
  return renderEmail({
    to: opts.to,
    subject: t('Invoices.emails.paid.subject', { number: invoice.number }),
    lines: [
      t('Dossiers.emails.greeting', { name: opts.name }),
      t('Invoices.emails.paid.body', {
        number: invoice.number,
        total: formatMoney(invoice.total, invoice.currency, locale),
      }),
    ],
    cta: t('Dossiers.emails.cta'),
    url: opts.url,
  });
}

/** Tells the consultant a Client uploaded a Preuve de paiement; the button opens the Facture. */
export function proofReceivedEmail(opts: {
  to: string;
  locale: unknown;
  client: string;
  invoice: InvoiceFacts;
  url: string;
}): EmailMessage {
  const { locale, t } = translator(opts.locale);
  const { invoice } = opts;
  return renderEmail({
    to: opts.to,
    subject: t('Invoices.emails.proof.subject', { client: opts.client, number: invoice.number }),
    lines: [
      t('Invoices.emails.proof.body', {
        client: opts.client,
        number: invoice.number,
        total: formatMoney(invoice.total, invoice.currency, locale),
      }),
    ],
    cta: t('Invoices.emails.proof.cta'),
    url: opts.url,
  });
}
