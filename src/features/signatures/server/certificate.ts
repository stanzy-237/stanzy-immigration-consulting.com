import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import type { SignPdfData } from '@/features/signatures/lib/sign-pdf';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

// The Factures' letterhead, shipped with the server bundle (next.config.ts).
const LETTERHEAD = join(process.cwd(), 'src/features/invoices/assets/letterhead.pdf');
let letterhead: Promise<Uint8Array | null> | null = null;

/**
 * The Certificat de signature (#96) in the Client's language: who signed,
 * when (Douala time), from where, and the original PDF's fingerprint; also
 * the date DATE fields print and the signed file's name suffix.
 */
export async function certificateFor(opts: {
  locale: string;
  document: string;
  service: ServiceType;
  account: { name: string; email: string };
  name: string;
  signedAt: Date;
  ip: string;
  device: string;
  fingerprint: string;
  requestId: string;
  stamped: boolean;
}): Promise<{
  page: SignPdfData['certificate'];
  date: string;
  suffix: string;
  letterhead: Uint8Array | null;
}> {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'Africa/Douala',
  }).format(opts.signedAt);
  letterhead ??= readFile(LETTERHEAD).then(
    (bytes) => new Uint8Array(bytes),
    () => null,
  );

  const rows: [string, string][] = [
    [t('Signatures.certificate.document'), opts.document],
    [t('Signatures.certificate.dossier'), t(`Dossiers.services.${opts.service}`)],
    [t('Signatures.certificate.signedBy'), opts.name],
    [t('Signatures.certificate.account'), `${opts.account.name} <${opts.account.email}>`],
    [t('Signatures.certificate.signedAt'), t('Signatures.certificate.signedAtValue', { when })],
    [t('Signatures.certificate.ip'), opts.ip || t('Signatures.certificate.unknown')],
    [t('Signatures.certificate.device'), opts.device || t('Signatures.certificate.unknown')],
    [t('Signatures.certificate.fingerprint'), opts.fingerprint],
    [t('Signatures.certificate.reference'), opts.requestId],
  ];
  if (opts.stamped) rows.push([t('Signatures.certificate.stamp'), t('Signatures.certificate.stampValue')]);

  return {
    page: { title: t('Signatures.certificate.title'), rows, note: t('Signatures.certificate.note') },
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Africa/Douala' }).format(opts.signedAt),
    suffix: t('Signatures.certificate.fileSuffix'),
    letterhead: await letterhead,
  };
}
