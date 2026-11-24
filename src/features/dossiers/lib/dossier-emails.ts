import { createTranslator } from 'next-intl';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { brandEmail, teamEmail, type BrandEmail, type EmailArt, type EmailCard } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

const MESSAGES = { fr, en } as const;

/** What happened to the Dossier, as the Client is told. */
export type DossierChange =
  | { kind: 'opened'; stage: string }
  | { kind: 'stageChanged'; stage: string }
  | { kind: 'closed'; reason: string }
  | { kind: 'newVersion'; document: string }
  | { kind: 'comment'; document: string; excerpt: string }
  | { kind: 'message'; excerpt: string }
  | { kind: 'signatureRequested'; document: string }
  | { kind: 'signatureReminder'; document: string }
  | { kind: 'signed'; document: string };

/** What the Client did, as the consultant is told. */
export type ClientActivity =
  | { kind: 'clientUpload'; document: string }
  | { kind: 'clientComment'; document: string; excerpt: string }
  | { kind: 'clientMessage'; excerpt: string }
  | { kind: 'clientSigned'; document: string };

/** A comment as quoted in an email: its first 200 characters. */
export const excerptOf = (body: string): string => (body.length > 200 ? `${body.slice(0, 199)}…` : body);

/**
 * One of the app's notification e-mails, in the Stanzy e-mail design
 * (server/email/brand-email.ts): paragraphs and a rouge button, plus whatever
 * of its board (label, illustration, title, card, links, footer) it gives.
 */
export function renderEmail(
  opts: { to: string; subject: string; lines: string[]; cta: string; url: string } & Partial<
    Pick<BrandEmail, 'eyebrow' | 'art' | 'title' | 'card' | 'links' | 'note' | 'footer' | 'help' | 'attachments'>
  >,
): EmailMessage {
  const { cta, url, lines, ...rest } = opts;
  return brandEmail({ eyebrow: 'Stanzy Immigration', footer: 'Stanzy Immigration Consulting', ...rest, lines: withGreeting(lines), cta: { label: cta, url } });
}

/** Words that keep their capital after « Bonjour Aminata, »: names, not sentence starts. */
const PROPER = /^(Stanzy|IRCC|TCF|EDE|WES|CRS|Mon espace|My space)\b/;

/**
 * « Bonjour Aminata, » and the next paragraph read as one sentence, as the
 * boards write it: « Bonjour Aminata, votre dossier… ». A name or a quote
 * keeps its capital.
 */
export function withGreeting(lines: string[]): string[] {
  const [first, second, ...rest] = lines;
  if (!first || !second || !/,$/.test(first.trim()) || first.length > 60) return lines;
  const next = PROPER.test(second) || /^[«“"]/.test(second) || /^\p{Lu}{2}/u.test(second) ? second : `${second.charAt(0).toLowerCase()}${second.slice(1)}`;
  return [`${first.trim()} ${next}`, ...rest];
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
  const stageName = (stage: string) => t(`stages.${opts.service}.${stage}` as never);
  const body =
    change.kind === 'closed' || change.kind === 'comment' || change.kind === 'message' || change.kind === 'stageChanged'
      ? t(`emails.${change.kind}.bodyShort`, { service, document: 'document' in change ? change.document : '' })
      : change.kind === 'newVersion' || change.kind === 'signatureRequested' || change.kind === 'signatureReminder' || change.kind === 'signed'
        ? t(`emails.${change.kind}.body`, { service, document: change.document })
        : t('emails.opened.body', { service, stage: stageName(change.stage) });
  // Board 3.4 / 3.5: what changed, in a card under the text.
  const card: EmailCard =
    change.kind === 'opened'
      ? { kind: 'note', label: t('emails.stage'), text: stageName(change.stage) }
      : change.kind === 'stageChanged'
        ? { kind: 'note', label: t('emails.newStage'), text: stageName(change.stage) }
        : change.kind === 'closed'
          ? { kind: 'note', label: t('emails.reason'), text: change.reason }
          : change.kind === 'newVersion'
            ? { kind: 'note', label: t('emails.document'), text: change.document }
            : change.kind === 'comment'
              ? { kind: 'note', label: t('emails.on', { document: change.document }), text: change.excerpt, quote: true }
              : change.kind === 'message'
                ? { kind: 'note', label: t('emails.messageLabel'), text: change.excerpt, quote: true }
                : { kind: 'file', title: change.document, sub: t(`emails.${change.kind}.file`) };
  const signing = change.kind === 'signatureRequested' || change.kind === 'signatureReminder' || change.kind === 'signed';
  const art: EmailArt = signing
    ? 'signature'
    : change.kind === 'newVersion'
      ? 'file'
      : change.kind === 'comment' || change.kind === 'message'
        ? 'message'
        : 'dossier';

  return renderEmail({
    to: opts.to,
    subject: t(`emails.${change.kind}.subject`, { service }),
    eyebrow: signing ? t(`emails.${change.kind}.eyebrow`) : t('emails.eyebrow'),
    art,
    title: t(`emails.${change.kind}.title`),
    lines: [t('emails.greeting', { name: opts.name }), body],
    card,
    cta:
      change.kind === 'signatureRequested' || change.kind === 'signatureReminder'
        ? t(`emails.${change.kind}.cta`)
        : t('emails.cta'),
    url: opts.url,
    footer: t('emails.footer', { service }),
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
    activity.kind === 'clientSigned'
      ? t('consultantEmails.clientSigned.body', { client, service, document: activity.document })
      : t(`consultantEmails.${activity.kind}.bodyShort`, { client, service, document: 'document' in activity ? activity.document : '' });
  const document = 'document' in activity ? activity.document : '';

  // Board 3.8: compact, who did what, the comment or message quoted.
  return teamEmail({
    to: opts.to,
    subject: t(`consultantEmails.${activity.kind}.subject`, { client, document }),
    person: { name: client, context: service },
    tag: t(`consultantEmails.${activity.kind}.tag`),
    lines: [body],
    note:
      activity.kind === 'clientComment' || activity.kind === 'clientMessage'
        ? { text: activity.excerpt, quote: true }
        : { label: activity.document, text: t(`consultantEmails.${activity.kind}.tag`) },
    cta: { label: t('consultantEmails.cta'), url: opts.url },
  });
}
