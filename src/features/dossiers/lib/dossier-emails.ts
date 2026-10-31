import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** What happened to the Dossier, as the Client is told. */
export type DossierChange =
  | { kind: 'opened'; stage: string }
  | { kind: 'stageChanged'; stage: string }
  | { kind: 'closed'; reason: string };

/**
 * The email a Client receives when their Dossier opens, changes stage or is
 * closed, in the language their Account signed up in, with a button to
 * « Mon espace ». Copy comes from `Dossiers.emails`.
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
      : t(`emails.${change.kind}.body`, {
          service,
          stage: t(`stages.${opts.service}.${change.stage}` as never),
        });
  const greeting = t('emails.greeting', { name: opts.name });

  return {
    to: opts.to,
    subject: t(`emails.${change.kind}.subject`, { service }),
    text: [greeting, '', body, '', opts.url].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#0D1F4E;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#CC1627;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t('emails.cta'))}</a></p>
</div>`,
  };
}
