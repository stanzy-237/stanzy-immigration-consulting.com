import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

type Contract = { number: string; title: string; service: ServiceType; amendment: boolean };

const translator = (locale: unknown) => {
  const lang = toLocale(locale);
  return createTranslator({ locale: lang, messages: MESSAGES[lang] });
};

/** To the Client: a Contrat (or an Avenant) to read and sign; the button opens it on its fields. */
export function contractSentEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  contract: Contract;
  url: string;
}): EmailMessage {
  const t = translator(opts.locale);
  const kind = opts.contract.amendment ? 'amendmentSent' : 'sent';
  const values = {
    number: opts.contract.number,
    title: opts.contract.title,
    service: t(`Dossiers.services.${opts.contract.service}`),
  };
  return renderEmail({
    to: opts.to,
    subject: t(`Contracts.emails.${kind}.subject`, values),
    lines: [t('Contracts.emails.greeting', { name: opts.name }), t(`Contracts.emails.${kind}.body`, values)],
    cta: t(`Contracts.emails.${kind}.cta`),
    url: opts.url,
  });
}

/** To the Client, once signed: the signed PDF with its Certificat de signature. */
export function contractSignedEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  contract: Contract;
  pdf: Buffer;
  url: string;
}): EmailMessage {
  const t = translator(opts.locale);
  const values = { number: opts.contract.number, title: opts.contract.title };
  return {
    ...renderEmail({
      to: opts.to,
      subject: t('Contracts.emails.signed.subject', values),
      lines: [t('Contracts.emails.greeting', { name: opts.name }), t('Contracts.emails.signed.body', values)],
      cta: t('Contracts.emails.signed.cta'),
      url: opts.url,
    }),
    attachments: [{ filename: `${opts.contract.number}.pdf`, content: opts.pdf }],
  };
}

/** To each consultant: the Client signed; the signed PDF attached. */
export function consultantContractSignedEmail(opts: {
  to: string;
  locale: unknown;
  client: string;
  contract: Contract;
  pdf: Buffer;
  url: string;
}): EmailMessage {
  const t = translator(opts.locale);
  const values = {
    client: opts.client,
    number: opts.contract.number,
    title: opts.contract.title,
    service: t(`Dossiers.services.${opts.contract.service}`),
  };
  return {
    ...renderEmail({
      to: opts.to,
      subject: t('Contracts.emails.consultantSigned.subject', values),
      lines: [t('Contracts.emails.consultantSigned.body', values)],
      cta: t('Contracts.emails.consultantSigned.cta'),
      url: opts.url,
    }),
    attachments: [{ filename: `${opts.contract.number}.pdf`, content: opts.pdf }],
  };
}
