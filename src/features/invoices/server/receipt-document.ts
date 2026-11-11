import { createTranslator } from 'next-intl';

import { renderContractPdf } from '@/features/contracts/lib/contract-pdf';
import { contractBlocks } from '@/features/contracts/lib/contract-schema';
import { contractLetterhead } from '@/features/contracts/server/contract-document';
import type { PaymentMethod } from '@/features/invoices/lib/invoice-schema';
import type { Currency } from '@/features/invoices/lib/money';
import { receiptText } from '@/features/invoices/lib/receipt-text';
import type { ImageFile } from '@/features/signatures/lib/sign-pdf';
import type { SignatureField } from '@/features/signatures/lib/signature-schema';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

/**
 * A Reconnaissance de réception de fonds as a PDF (#145): Stanzy's template
 * filled in, on the letterhead, drawn like a Contrat. On one side the
 * consultant's signature and the stamp, applied now; on the other « Le
 * Concerné »'s fields, returned for the Client to sign in the app.
 */
export async function receiptPdf(opts: {
  locale: string;
  number: string;
  client: string;
  service: string;
  amount: number;
  total: number;
  balance: number;
  currency: Currency;
  receivedOn: string;
  method: PaymentMethod;
  methodNote: string | null;
  issuedAt: Date;
  consultant: { signature: ImageFile; stamp: ImageFile };
}): Promise<{ bytes: Uint8Array; fields: SignatureField[] }> {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const issuedOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(opts.issuedAt);
  const { title, body } = receiptText({ ...opts, issuedOn });
  return renderContractPdf(await contractLetterhead(), {
    title,
    subtitle: t('Invoices.receipt.number', { number: opts.number }),
    blocks: contractBlocks(body),
    sentOn: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' }).format(
      opts.issuedAt,
    ),
    consultant: opts.consultant,
    labels: {
      client: t('Invoices.receipt.client'),
      company: t('Invoices.receipt.company'),
      signature: t('Contracts.pdf.signature'),
      name: t('Contracts.pdf.name'),
      date: t('Contracts.pdf.date'),
      page: (page, pages) => t('Contracts.pdf.page', { page, pages }),
    },
  });
}
