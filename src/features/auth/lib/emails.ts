import { createTranslator } from 'next-intl';

import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { brandEmail } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

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
 * A short email whose point is one link (board 3.1): greeting and body,
 * button, expiry and "ignore this if it wasn't you". Copy comes from `Auth.Emails.<kind>`.
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
  const shared = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Auth.Emails' });

  // Board 3.1: the link is the e-mail's only point; its expiry and « ignore it » under the button.
  return brandEmail({
    to: opts.to,
    subject: t('subject'),
    eyebrow: shared('eyebrow'),
    art: kind === 'Verification' ? 'envelope' : 'lock',
    title: t('title'),
    // « Bonjour Aminata, merci pour… »: one sentence, as the board reads.
    lines: [`${t('greeting', { name: opts.name })} ${t('body').charAt(0).toLowerCase()}${t('body').slice(1)}`],
    cta: { label: t('cta'), url: opts.url },
    note: `${t('expiry')} ${t('ignore')}`,
    footer: shared('footer'),
  });
}

/**
 * « Votre compte est prêt » (`Mon compte · 2 E-mail`): the Account created at
 * a booking without one has no password; the link sets the first one. It
 * shows the address they sign in with, never a password.
 */
export function accountReadyEmail(opts: LinkEmailOptions & { days: number }): EmailMessage {
  const locale = toLocale(opts.locale);
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Auth.Emails.AccountReady' });
  const shared = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Auth.Emails' });
  return brandEmail({
    to: opts.to,
    subject: t('subject'),
    eyebrow: shared('eyebrow'),
    art: 'lock',
    title: t('title', { name: opts.name.trim().split(/\s+/)[0] ?? opts.name }),
    lines: [t('body')],
    card: {
      kind: 'rows',
      rows: [
        { label: t('login'), value: opts.to },
        { label: t('password'), value: t('passwordValue') },
      ],
    },
    cta: { label: t('cta'), url: opts.url },
    note: `${t('expiry', { days: opts.days })} ${t('ignore')}`,
    footer: shared('footer'),
  });
}
