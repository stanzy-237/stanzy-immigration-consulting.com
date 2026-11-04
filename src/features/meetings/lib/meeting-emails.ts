import { createTranslator } from 'next-intl';

import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

export type MeetingEmailKind = 'scheduled' | 'moved' | 'cancelled' | 'dayBefore' | 'soon';

/** « mardi 10 novembre 2026 à 14:00 (heure de Douala) »: where the practice is. */
export function meetingWhen(startsAt: Date, locale: unknown): string {
  const lang = toLocale(locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const when = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(startsAt);
  return t('Meetings.emails.when', { when });
}

/**
 * To the Client: a Réunion planned, moved, cancelled, or coming (the day
 * before, 15 minutes before), with a button to its room (or the Dossier
 * once cancelled).
 */
export function meetingEmail(opts: {
  to: string;
  name: string;
  locale: unknown;
  kind: MeetingEmailKind;
  meeting: { subject: string; startsAt: Date; durationMinutes: number; recording: boolean };
  reason?: string | null;
  url: string;
}): EmailMessage {
  const lang = toLocale(opts.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const values = {
    subject: opts.meeting.subject,
    when: meetingWhen(opts.meeting.startsAt, lang),
    minutes: opts.meeting.durationMinutes,
  };
  const lines = [t('Meetings.emails.greeting', { name: opts.name }), t(`Meetings.emails.${opts.kind}.body`, values)];
  if (opts.kind === 'cancelled' && opts.reason) lines.push(t('Meetings.emails.reason', { reason: opts.reason }));
  if (opts.kind !== 'cancelled' && opts.meeting.recording) lines.push(t('Meetings.emails.recorded'));
  return renderEmail({
    to: opts.to,
    subject: t(`Meetings.emails.${opts.kind}.subject`, values),
    lines,
    cta: t(opts.kind === 'cancelled' ? 'Meetings.emails.openDossier' : 'Meetings.emails.join'),
    url: opts.url,
  });
}
