import { createTranslator } from 'next-intl';

import { amountInWords } from '@/features/invoices/lib/amount-in-words';
import { PAYMENT_METHODS, type PaymentMethod } from '@/features/invoices/lib/invoice-schema';
import { formatMoney, type Currency } from '@/features/invoices/lib/money';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;


/** `2026-11-09` → `09/11/2026`, as the template's « ____ / ____ / ______ ». */
const slashed = (day: string): string => day.split('-').reverse().join('/');

/**
 * A Reconnaissance de réception de fonds (#145), in the Client's language,
 * from Stanzy's template: who paid, how much (in figures and in words), for
 * what, the total, the balance, how it was paid (the list ticked) and the
 * day. Its body is in the Contrat's text format (paragraphs and `- `
 * bullets), so it draws with the Contrat's PDF and signature block.
 */
export function receiptText(facts: {
  locale: string;
  client: string;
  service: string;
  /** Minor units, as the Facture's lines. */
  amount: number;
  total: number;
  balance: number;
  currency: Currency;
  /** `YYYY-MM-DD`. */
  receivedOn: string;
  method: PaymentMethod;
  methodNote: string | null;
  /** The day it is drawn up (`YYYY-MM-DD`); the day received by default. */
  issuedOn?: string;
}): { title: string; body: string } {
  const locale = toLocale(facts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Invoices.receipt' });
  const money = (minor: number) => formatMoney(minor, facts.currency, locale);
  // XAF has no minor unit; CAD and EUR count cents, written in words as whole units.
  const whole = facts.currency === 'XAF' ? facts.amount : Math.floor(facts.amount / 100);
  const methods = PAYMENT_METHODS.map((method) => {
    const ticked = method === facts.method;
    const label = t(`methods.${method}`);
    const note = method === 'OTHER' && ticked && facts.methodNote ? ` : ${facts.methodNote}` : '';
    return `- ${ticked ? '[X]' : '[  ]'} ${label}${note}`;
  }).join('\n');
  return {
    title: t('title'),
    body: t('body', {
      client: facts.client,
      amount: money(facts.amount),
      words: amountInWords(whole, locale),
      currencyWords: t(`currencyWords.${facts.currency}`),
      service: facts.service,
      total: money(facts.total),
      balance: money(facts.balance),
      receivedOn: slashed(facts.receivedOn),
      methods,
      issuedOn: slashed(facts.issuedOn ?? facts.receivedOn),
    }),
  };
}
