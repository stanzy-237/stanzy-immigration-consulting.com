import { createTranslator } from 'next-intl';

import { renderEmail } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { slotParts, type EmailArt } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

export type MeetingEmailKind = 'scheduled' | 'instant' | 'moved' | 'cancelled' | 'dayBefore' | 'soon';

/** Each e-mail's illustration on board 3.3. */
const ART: Record<MeetingEmailKind, EmailArt> = {
  scheduled: 'calendar',
  instant: 'camera',
  moved: 'moved',
  cancelled: 'cancelled',
  dayBefore: 'calendar',
  soon: 'camera',
};

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
  const firstName = opts.name.trim().split(/\s+/)[0] ?? opts.name;
  const slot = slotParts(opts.meeting.startsAt, opts.meeting.durationMinutes, lang);
  const minutes = opts.meeting.durationMinutes;
  // Board 3.3: a « when » card in Douala time, then « Rejoindre la réunion ».
  return renderEmail({
    to: opts.to,
    subject: t(`Meetings.emails.${opts.kind}.subject`, values),
    eyebrow: t(`Meetings.emails.${opts.kind}.eyebrow`),
    art: ART[opts.kind],
    title: t(`Meetings.emails.${opts.kind}.title`, { name: firstName }),
    lines,
    card: {
      kind: 'slot',
      ...slot,
      sub:
        opts.kind === 'cancelled'
          ? t('Meetings.emails.subCancelled')
          : opts.meeting.recording
            ? t('Meetings.emails.subRecorded', { minutes })
            : t('Meetings.emails.sub', { minutes }),
    },
    cta: t(opts.kind === 'cancelled' ? 'Meetings.emails.openDossier' : 'Meetings.emails.join'),
    note: opts.kind !== 'cancelled' && opts.meeting.recording ? t('Meetings.emails.recorded') : undefined,
    footer: t('Meetings.emails.footer'),
    url: opts.url,
  });
}
