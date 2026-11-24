import { createTranslator } from 'next-intl';

import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { teamEmail } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

const translator = (locale: unknown) => {
  const lang = toLocale(locale);
  return createTranslator({ locale: lang, messages: MESSAGES[lang] });
};

/** To each consultant: a new Demande d'intérêt, with its Niveau (board 3.8). */
export function newInterestEmail(opts: { to: string; locale: unknown; client: string; level: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return teamEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.submitted.subject', { client: opts.client }),
    person: { name: opts.client, context: t('Accompagnement.emails.context') },
    tag: t('Accompagnement.emails.submitted.tag'),
    lines: [t('Accompagnement.emails.submitted.body', { client: opts.client, level: opts.level })],
    note: { text: t('Accompagnement.emails.submitted.level', { level: opts.level }) },
    cta: { label: t('Accompagnement.emails.submitted.cta'), url: opts.url },
  });
}

/** To the User: their Demande is approved, their Dossier open at its stage (board 3.7). */
export function interestApprovedEmail(opts: { to: string; name: string; locale: unknown; stage: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return renderEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.approved.subject'),
    eyebrow: t('Accompagnement.emails.eyebrow'),
    art: 'accompagne',
    title: t('Accompagnement.emails.approved.title'),
    lines: [t('Accompagnement.emails.greeting', { name: opts.name }), t('Accompagnement.emails.approved.body', { stage: opts.stage })],
    card: { kind: 'note', label: t('Accompagnement.emails.approved.nextLabel'), text: t('Accompagnement.emails.approved.next') },
    cta: t('Accompagnement.emails.approved.cta'),
    url: opts.url,
    footer: t('Accompagnement.emails.footer'),
  });
}

/** To the User: their Demande isn't accepted; they may send another. Gentle: no rouge, the door open. */
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
    eyebrow: t('Accompagnement.emails.eyebrow'),
    art: 'message',
    title: t('Accompagnement.emails.rejected.title'),
    lines: [
      t('Accompagnement.emails.greeting', { name: opts.name }),
      `${t('Accompagnement.emails.rejected.body')} ${t('Accompagnement.emails.rejected.again')}`,
    ],
    ...(opts.reason ? { card: { kind: 'note' as const, label: t('Accompagnement.emails.reasonLabel'), text: opts.reason } } : {}),
    cta: t('Accompagnement.emails.rejected.cta'),
    url: opts.url,
    footer: t('Accompagnement.emails.footer'),
  });
}

/** To each consultant: a Client asks Stanzy to get a Document (board 3.8). */
export function stanzyRequestedEmail(opts: { to: string; locale: unknown; client: string; document: string; url: string }): EmailMessage {
  const t = translator(opts.locale);
  return teamEmail({
    to: opts.to,
    subject: t('Accompagnement.emails.stanzyRequested.subject', { client: opts.client }),
    person: { name: opts.client, context: t('Accompagnement.emails.context') },
    tag: t('Accompagnement.emails.stanzyRequested.tag'),
    lines: [t('Accompagnement.emails.stanzyRequested.body', { client: opts.client, document: opts.document })],
    note: { text: opts.document },
    cta: { label: t('Accompagnement.emails.stanzyRequested.cta'), url: opts.url },
  });
}

/** To the Client: Stanzy won't get that Document; they get it themselves (board 3.7). */
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
    eyebrow: t('Accompagnement.emails.stanzyDeclined.eyebrow'),
    art: 'file',
    title: t('Accompagnement.emails.stanzyDeclined.title'),
    lines: [t('Accompagnement.emails.greeting', { name: opts.name }), t('Accompagnement.emails.stanzyDeclined.body', { document: opts.document })],
    ...(opts.note ? { card: { kind: 'note' as const, label: t('Accompagnement.emails.reasonLabel'), text: opts.note } } : {}),
    cta: t('Accompagnement.emails.stanzyDeclined.cta'),
    url: opts.url,
    footer: t('Accompagnement.emails.footer'),
  });
}
