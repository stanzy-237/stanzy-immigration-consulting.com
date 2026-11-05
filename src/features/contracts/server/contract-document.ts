import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';

import { renderContractPdf } from '@/features/contracts/lib/contract-pdf';
import { contractBlocks, fillBlanks } from '@/features/contracts/lib/contract-schema';
import type { ServiceType } from '@/features/dossiers/data/workflows';
import { formatMoney, type Currency } from '@/features/invoices/lib/money';
import type { ImageFile } from '@/features/signatures/lib/sign-pdf';
import type { SignatureField } from '@/features/signatures/lib/signature-schema';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

// The Factures' letterhead, shipped with the server bundle (next.config.ts).
const LETTERHEAD = join(process.cwd(), 'src/features/invoices/assets/letterhead.pdf');
let letterhead: Promise<Uint8Array> | null = null;

export const contractLetterhead = (): Promise<Uint8Array> =>
  (letterhead ??= readFile(LETTERHEAD).then((bytes) => new Uint8Array(bytes)));

const longDate = (locale: string, date: Date) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' }).format(
    date,
  );

/** A template's text with its blanks filled in for this Contrat, in its language. */
export function filledContract(opts: {
  locale: string;
  template: { title: string; body: string };
  client: string;
  service: ServiceType;
  /** A Service documentaire's name (#80), in place of the Dossier's service. */
  serviceName?: string;
  amount: number;
  currency: Currency;
  schedule: string;
  number: string;
  sentAt: Date;
}): { title: string; body: string } {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const values = {
    client: opts.client,
    service: opts.serviceName ?? t(`Dossiers.services.${opts.service}`),
    prix: formatMoney(opts.amount, opts.currency, locale),
    echeancier: opts.schedule,
    date: longDate(locale, opts.sentAt),
    numero: opts.number,
  };
  return { title: fillBlanks(opts.template.title, values), body: fillBlanks(opts.template.body, values) };
}

/**
 * A Contrat's (or an Avenant's) PDF on the letterhead, in its language, with
 * the consultant's signature and the stamp, and where the Client's fields sit.
 */
export async function contractPdf(opts: {
  locale: string;
  title: string;
  body: string;
  number: string;
  /** For an Avenant: its rank and the Contrat it changes. */
  amendment: { rank: number; of: string } | null;
  sentAt: Date;
  consultant: { signature: ImageFile; stamp: ImageFile } | null;
}): Promise<{ bytes: Uint8Array; fields: SignatureField[] }> {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  return renderContractPdf(await contractLetterhead(), {
    title: opts.title,
    subtitle: opts.amendment
      ? t('Contracts.pdf.amendmentOf', { n: opts.amendment.rank, number: opts.amendment.of })
      : t('Contracts.pdf.number', { number: opts.number }),
    blocks: contractBlocks(opts.body),
    sentOn: longDate(locale, opts.sentAt),
    consultant: opts.consultant,
    labels: {
      client: t('Contracts.pdf.client'),
      company: t('Contracts.pdf.company'),
      signature: t('Contracts.pdf.signature'),
      name: t('Contracts.pdf.name'),
      date: t('Contracts.pdf.date'),
      page: (page, pages) => t('Contracts.pdf.page', { page, pages }),
    },
  });
}
