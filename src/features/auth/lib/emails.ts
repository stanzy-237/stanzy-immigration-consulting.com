import { createTranslator } from 'next-intl';

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

type LinkEmailOptions = {
  to: string;
  name: string;
  url: string;
  locale: unknown;
};

/** The "confirm your email address" email sent after sign-up. */
export function verificationEmail(opts: LinkEmailOptions): EmailMessage {
  return linkEmail('Verification', opts);
}

/** The "reset your password" email sent from Mot de passe oublié. */
export function resetPasswordEmail(opts: LinkEmailOptions): EmailMessage {
  return linkEmail('ResetPassword', opts);
}

/**
 * A short email whose point is one link: greeting, body, button, expiry and
 * "ignore this if it wasn't you". Copy comes from `Auth.Emails.<kind>`.
 */
function linkEmail(
  kind: 'Verification' | 'ResetPassword',
  opts: LinkEmailOptions,
): EmailMessage {
  const locale = toLocale(opts.locale);
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: `Auth.Emails.${kind}`,
  });
  const greeting = t('greeting', { name: opts.name });

  return {
    to: opts.to,
    subject: t('subject'),
    text: [greeting, '', t('body'), '', opts.url, '', t('expiry'), t('ignore')].join(
      '\n',
    ),
    html: `<div style="font-family:Arial,sans-serif;color:#0D1F4E;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(t('body'))}</p>
<p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#CC1627;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t('cta'))}</a></p>
<p style="font-size:13px;color:#5B6478">${escapeHtml(t('expiry'))}<br>${escapeHtml(t('ignore'))}</p>
</div>`,
  };
}
