import { createTranslator } from 'next-intl';

import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

const translator = (locale: unknown) => {
  const lang = toLocale(locale);
  return createTranslator({ locale: lang, messages: MESSAGES[lang] });
};

/** To each consultant: a new Demande d'intérêt, with its Niveau. */
export function newInterestEmail(opts: { to: string; locale: unknown; client: string; level: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.submitted.subject', { client: opts.client }),
    lines: [t('Accompagnement.emails.submitted.body', { client: opts.client, level: opts.level })],
    cta: t('Accompagnement.emails.submitted.cta'),
    url: opts.url,
  });
}

/** To the User: their Demande is approved, their Dossier open at its stage. */
export function interestApprovedEmail(opts: { to: string; name: string; locale: unknown; stage: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.approved.subject'),
    lines: [t('Accompagnement.emails.greeting', { name: opts.name }), t('Accompagnement.emails.approved.body', { stage: opts.stage }), t('Accompagnement.emails.approved.next')],
    cta: t('Accompagnement.emails.approved.cta'),
    url: opts.url,
  });
}

/** To the User: their Demande isn't accepted; they may send another. */
export function interestRejectedEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  reason: string | null;
  url: string;
}): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.rejected.subject'),
    lines: [
      t('Accompagnement.emails.greeting', { name: opts.name }),
      t('Accompagnement.emails.rejected.body'),
      ...(opts.reason ? [t('Accompagnement.emails.reason', { reason: opts.reason })] : []),
      t('Accompagnement.emails.rejected.again'),
    ],
    cta: t('Accompagnement.emails.rejected.cta'),
    url: opts.url,
  });
}

/** To each consultant: a Client asks Stanzy to get a Document. */
export function stanzyRequestedEmail(opts: { to: string; locale: unknown; client: string; document: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.stanzyRequested.subject', { client: opts.client }),
    lines: [t('Accompagnement.emails.stanzyRequested.body', { client: opts.client, document: opts.document })],
    cta: t('Accompagnement.emails.stanzyRequested.cta'),
    url: opts.url,
  });
}

/** To the Client: Stanzy won't get that Document; they get it themselves. */
export function stanzyDeclinedEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  document: string;
  note: string | null;
  url: string;
}): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.stanzyDeclined.subject', { document: opts.document }),
    lines: [
      t('Accompagnement.emails.greeting', { name: opts.name }),
      t('Accompagnement.emails.stanzyDeclined.body', { document: opts.document }),
      ...(opts.note ? [t('Accompagnement.emails.reason', { reason: opts.note })] : []),
    ],
    cta: t('Accompagnement.emails.stanzyDeclined.cta'),
    url: opts.url,
  });
}
