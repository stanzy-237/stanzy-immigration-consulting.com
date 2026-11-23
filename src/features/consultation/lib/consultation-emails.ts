import { createTranslator } from 'next-intl';

import { money } from '@/features/consultation/lib/money';
import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { meetingWhen } from '@/features/meetings/lib/meeting-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

/**
 * « Votre Consultation est confirmée » (board `3.2`): sent once SasPay said
 * `SUCCESS`, with the slot (« heure de Douala »), what was paid and a button
 * to its Réunion in Mon espace. `moved`: the slot was taken while the payment
 * was on its way, so it is the next free one; the Client can still move it.
 */
export function consultationPaidEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  startsAt: Date;
  durationMinutes: number;
  /** What left the payer, in the currency SasPay charged. */
  paid: { amount: number; currency: string };
  network: string | null;
  moved: boolean;
  url: string;
}): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Consultation.emails' });
  const when = meetingWhen(opts.startsAt, lang);
  const lines = [
    t('greeting', { name: opts.name.split(' ')[0] ?? opts.name }),
    t('paid.body', { when, minutes: opts.durationMinutes }),
    ...(opts.moved ? [t('paid.moved')] : []),
    t('paid.receipt', { amount: money(opts.paid.amount, opts.paid.currency, lang === 'fr' ? 'fr-FR' : 'en-CA'), network: opts.network ?? 'SasPay' }),
    t('paid.room'),
    t('paid.noRefund'),
  ];
  return renderEmail({ to: opts.to, subject: t('paid.subject', { when }), lines, cta: t('paid.cta'), url: opts.url });
}

/**
 * « Votre paiement n'est pas passé » (board `3.2`): SasPay said `FAILED`.
 * Nothing was charged; the slot stays held until `heldUntil`, then is released.
 */
export function consultationFailedEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  startsAt: Date;
  heldUntil: Date | null;
  network: string | null;
  url: string;
}): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Consultation.emails' });
  const until = opts.heldUntil
    ? new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-CA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(
        opts.heldUntil,
      )
    : null;
  const lines = [
    t('greeting', { name: opts.name.split(' ')[0] ?? opts.name }),
    t('failed.body', { network: opts.network ?? 'SasPay' }),
    t('failed.nothing'),
    until && opts.heldUntil! > new Date() ? t('failed.held', { time: until, when: meetingWhen(opts.startsAt, lang) }) : t('failed.released'),
  ];
  return renderEmail({ to: opts.to, subject: t('failed.subject'), lines, cta: t('failed.cta'), url: opts.url });
}
