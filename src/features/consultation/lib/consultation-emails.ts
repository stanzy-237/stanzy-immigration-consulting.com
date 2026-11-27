import { createTranslator } from 'next-intl';

import { money } from '@/features/consultation/lib/money';
import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { meetingWhen } from '@/features/meetings/lib/meeting-emails';
import { FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { slotParts, type EmailCard } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;
const WHATSAPP = FOOTER_SOCIALS.find((s) => s.key === 'whatsapp')?.href ?? null;

/** The slot card of board 3.2: the tile, « Mercredi 25 novembre · 09:00 – 09:45 », and one money row. */
function slotCard(startsAt: Date, minutes: number, lang: 'fr' | 'en', where: string, row: { label: string; value: string }): EmailCard {
  return { kind: 'slot', ...slotParts(startsAt, minutes, lang), sub: where, rows: [{ ...row }] };
}

/**
 * « C'est réservé » (board `3.2`): sent once SasPay said `SUCCESS`, with the
 * slot (heure de Douala), what was paid and how, its Facture payée attached
 * (by the caller), and a button to its Réunion in Mon espace. `moved`: the
 * slot was taken while the payment was on its way, so it is the next free
 * one; the Client can still move it.
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
  /** « BLACKFRIDAY −70 % », when a Code promo was used. */
  promo?: string | null;
  moved: boolean;
  url: string;
}): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Consultation.emails' });
  const when = meetingWhen(opts.startsAt, lang);
  const intl = lang === 'fr' ? 'fr-FR' : 'en-CA';
  const firstName = opts.name.trim().split(/\s+/)[0] ?? opts.name;
  const how = [opts.network === 'Carte bancaire' || !opts.network ? t('paid.card') : opts.network, opts.promo].filter(Boolean).join(' · ');
  return renderEmail({
    to: opts.to,
    subject: t('paid.subject', { when }),
    eyebrow: t('paid.eyebrow'),
    art: 'booked',
    title: t('paid.title', { name: firstName }),
    // Board 3.2: one paragraph; « Rejoindre » and « non remboursable » are on the Réunion's page and the Facture.
    lines: [`${t('paid.lead', { minutes: opts.durationMinutes })} ${t('paid.invoice')}`, ...(opts.moved ? [t('paid.moved')] : [])],
    card: slotCard(opts.startsAt, opts.durationMinutes, lang, t('where'), {
      label: t('paid.row', { how }),
      value: money(opts.paid.amount, opts.paid.currency, intl),
    }),
    cta: t('paid.cta'),
    url: opts.url,
    help: t('help'),
    footer: t('footer'),
  });
}

/**
 * « Le paiement n'est pas passé » (board `3.2`): SasPay said `FAILED`.
 * Nothing was charged; the slot stays held until `heldUntil`, then is released.
 */
export function consultationFailedEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  startsAt: Date;
  durationMinutes: number;
  heldUntil: Date | null;
  network: string | null;
  /** What was asked (FCFA). */
  amount: number;
  url: string;
}): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Consultation.emails' });
  const intl = lang === 'fr' ? 'fr-FR' : 'en-CA';
  const until = opts.heldUntil
    ? new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(opts.heldUntil)
    : null;
  return renderEmail({
    to: opts.to,
    subject: t('failed.subject'),
    eyebrow: t('failed.eyebrow'),
    art: 'refused',
    title: t('failed.title'),
    lines: [
      `${t('failed.body', { network: opts.network ?? 'SasPay' })} ${t('failed.nothing')}`,
      until && opts.heldUntil! > new Date() ? t('failed.held', { time: until, when: meetingWhen(opts.startsAt, lang) }) : t('failed.released'),
    ],
    card: slotCard(opts.startsAt, opts.durationMinutes, lang, t('where'), {
      label: t('failed.row', { how: opts.network ?? t('paid.card') }),
      value: money(opts.amount, 'XAF', intl),
    }),
    cta: t('failed.cta'),
    url: opts.url,
    links: WHATSAPP ? [{ label: t('whatsapp'), url: WHATSAPP }] : [],
    help: t('help'),
    footer: t('footer'),
  });
}

/**
 * « Votre enregistrement est prêt » (board `3.2`): sent the first time the
 * consultant publishes a Consultation to its Client's space. With next
 * steps, they are listed and the e-mail leads with them.
 */
export function consultationPublishedEmail(opts: { to: string; name: string; locale: unknown; startsAt: Date; steps: string[]; url: string }): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Consultation.emails' });
  const firstName = opts.name.trim().split(/\s+/)[0] ?? opts.name;
  const date = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Douala' }).format(opts.startsAt);
  const withSteps = opts.steps.length > 0;
  return renderEmail({
    to: opts.to,
    subject: t('published.subject'),
    eyebrow: t('published.eyebrow'),
    art: withSteps ? 'next-steps' : 'recording',
    title: t('published.title', { name: firstName }),
    lines: [t('published.lead', { date }), ...(withSteps ? [t('published.leadSteps', { count: opts.steps.length })] : [])],
    card: withSteps ? { kind: 'note', label: t('published.stepsLabel'), text: opts.steps.map((step, i) => `${i + 1}. ${step}`).join('  ·  ') } : undefined,
    cta: t('published.cta'),
    url: opts.url,
    help: t('help'),
    footer: t('footer'),
  });
}
