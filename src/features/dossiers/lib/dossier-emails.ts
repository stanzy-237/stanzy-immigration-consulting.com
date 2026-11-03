import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** What happened to the Dossier, as the Client is told. */
export type DossierChange =
  | { kind: 'opened'; stage: string }
  | { kind: 'stageChanged'; stage: string }
  | { kind: 'closed'; reason: string }
  | { kind: 'newVersion'; document: string }
  | { kind: 'comment'; document: string; excerpt: string }
  | { kind: 'signatureRequested'; document: string }
  | { kind: 'signed'; document: string };

/** What the Client did, as the consultant is told. */
export type ClientActivity =
  | { kind: 'clientUpload'; document: string }
  | { kind: 'clientComment'; document: string; excerpt: string }
  | { kind: 'clientSigned'; document: string };

/** A comment as quoted in an email: its first 200 characters. */
export const excerptOf = (body: string): string => (body.length > 200 ? `${body.slice(0, 199)}…` : body);

/** One of the app's notification emails: paragraphs, then a red button. */
export function renderEmail(opts: {
  to: string;
  subject: string;
  lines: string[];
  cta: string;
  url: string;
}): EmailMessage {
  return {
    to: opts.to,
    subject: opts.subject,
    text: [...opts.lines.flatMap((line) => [line, '']), opts.url].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#0D1F4E;line-height:1.5">
${opts.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
<p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#CC1627;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(opts.cta)}</a></p>
</div>`,
  };
}

/**
 * The email a Client receives when their Dossier opens, changes stage or is
 * closed, or when the consultant adds a Version or a comment, in the language
 * their Account signed up in, with a button to « Mon espace ». Copy comes from
 * `Dossiers.emails`.
 */
export function dossierEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  service: ServiceType;
  change: DossierChange;
  /** « Mon espace », absolute. */
  url: string;
}): EmailMessage {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Dossiers' });
  const service = t(`services.${opts.service}`);
  const { change } = opts;
  const body =
    change.kind === 'closed'
      ? t('emails.closed.body', { service, reason: change.reason })
      : change.kind === 'newVersion'
        ? t('emails.newVersion.body', { service, document: change.document })
        : change.kind === 'comment'
          ? t('emails.comment.body', { service, document: change.document, excerpt: change.excerpt })
          : change.kind === 'signatureRequested' || change.kind === 'signed'
            ? t(`emails.${change.kind}.body`, { service, document: change.document })
            : t(`emails.${change.kind}.body`, {
              service,
              stage: t(`stages.${opts.service}.${change.stage}` as never),
            });

  return renderEmail({
    to: opts.to,
    subject: t(`emails.${change.kind}.subject`, { service }),
    lines: [t('emails.greeting', { name: opts.name }), body],
    cta: t('emails.cta'),
    url: opts.url,
  });
}

/**
 * The email the consultant receives when a Client uploads a Version or
 * comments, with a button to the Dossier in the Tableau de bord. Copy comes
 * from `Dossiers.consultantEmails`.
 */
export function consultantEmail(opts: {
  to: string;
  locale: unknown;
  client: string;
  service: ServiceType;
  activity: ClientActivity;
  /** The Dossier in the Tableau de bord, absolute. */
  url: string;
}): EmailMessage {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Dossiers' });
  const { activity, client } = opts;
  const service = t(`services.${opts.service}`);
  const body =
    activity.kind === 'clientUpload' || activity.kind === 'clientSigned'
      ? t(`consultantEmails.${activity.kind}.body`, { client, service, document: activity.document })
      : t('consultantEmails.clientComment.body', {
          client,
          service,
          document: activity.document,
          excerpt: activity.excerpt,
        });

  return renderEmail({
    to: opts.to,
    subject: t(`consultantEmails.${activity.kind}.subject`, { client, document: activity.document }),
    lines: [body],
    cta: t('consultantEmails.cta'),
    url: opts.url,
  });
}
