import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { formatMoney, type Currency } from '@/features/invoices/lib/money';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { teamEmail } from '@/server/email/brand-email';
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
      eyebrow: t('Invoices.emails.sent.eyebrow'),
      art: 'invoice',
      title: t('Invoices.emails.sent.title', { number: invoice.number }),
      card: {
        kind: 'rows',
        rows: [
          { label: t('Invoices.emails.amount'), value: total, tone: 'big' },
          ...(due ? [{ label: t('Invoices.emails.dueBy'), value: due }] : []),
        ],
      },
      note: t('Invoices.emails.sent.proof'),
      footer: t('Invoices.emails.footer'),
      lines: [
        t('Dossiers.emails.greeting', { name: opts.name }),
        due
          ? t('Invoices.emails.sent.bodyDue', { number: invoice.number, service, total, due })
          : t('Invoices.emails.sent.body', { number: invoice.number, service, total }),
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
  const total = formatMoney(invoice.total, invoice.currency, locale);
  return renderEmail({
    to: opts.to,
    subject: t('Invoices.emails.paid.subject', { number: invoice.number }),
    eyebrow: t('Invoices.emails.paid.eyebrow'),
    art: 'invoice',
    title: t('Invoices.emails.paid.title'),
    card: {
      kind: 'rows',
      rows: [
        { label: t('Invoices.emails.amount'), value: total, tone: 'big' },
        { label: t('Invoices.emails.status'), value: t('Invoices.emails.paidStatus'), tone: 'leaf' },
      ],
    },
    footer: t('Invoices.emails.footer'),
    lines: [
      t('Dossiers.emails.greeting', { name: opts.name }),
      t('Invoices.emails.paid.body', { number: invoice.number, total }),
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
  const total = formatMoney(invoice.total, invoice.currency, locale);
  // Board 3.8: compact, to the team.
  return teamEmail({
    to: opts.to,
    subject: t('Invoices.emails.proof.subject', { client: opts.client, number: invoice.number }),
    person: { name: opts.client, context: t(`Dossiers.services.${invoice.service}`) },
    tag: t('Invoices.emails.tag'),
    lines: [t('Invoices.emails.proof.body', { client: opts.client, number: invoice.number, total })],
    note: { label: invoice.number, text: total },
    cta: { label: t('Invoices.emails.proof.cta'), url: opts.url },
  });
}

/**
 * Reminds the Client of a sent Facture: `dueSoon` 3 days before its due
 * date, `overdue` the day it passed (#92). The button opens their Factures.
 */
export function invoiceReminderEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  kind: 'dueSoon' | 'overdue';
  invoice: InvoiceFacts;
  url: string;
}): EmailMessage {
  const { locale, t } = translator(opts.locale);
  const { invoice } = opts;
  const values = {
    number: invoice.number,
    total: formatMoney(invoice.total, invoice.currency, locale),
    due: invoice.dueDate
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
          invoice.dueDate,
        )
      : '',
  };
  const overdue = opts.kind === 'overdue';
  return renderEmail({
    to: opts.to,
    subject: t(`Invoices.emails.${opts.kind}.subject`, values),
    eyebrow: t(`Invoices.emails.${opts.kind}.eyebrow`),
    art: 'invoice',
    title: t(`Invoices.emails.${opts.kind}.title`),
    card: {
      kind: 'rows',
      rows: [
        { label: t('Invoices.emails.amount'), value: values.total, tone: 'big' },
        overdue
          ? { label: t('Invoices.emails.due'), value: t('Invoices.emails.duePassed', { due: values.due }), tone: 'rouge' }
          : { label: t('Invoices.emails.dueBy'), value: values.due },
      ],
    },
    note: t('Invoices.emails.sent.proof'),
    footer: t('Invoices.emails.footer'),
    lines: [t('Dossiers.emails.greeting', { name: opts.name }), t(`Invoices.emails.${opts.kind}.body`, values)],
    cta: t('Dossiers.emails.cta'),
    url: opts.url,
  });
}
