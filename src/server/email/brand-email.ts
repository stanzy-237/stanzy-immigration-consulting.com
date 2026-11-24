import { siteUrl } from '@/lib/site-url';
import type { EmailMessage } from '@/server/email/mailer';

/**
 * The Stanzy e-mail, as designed in Paper (page « Marketing Stanzy », boards
 * `E-mails · 3.1` to `3.9`): the logo and a small label, a brand illustration,
 * a Syne title, the text, a card (a slot, an amount, a note, a file), the rouge
 * button, small links, and a grey footer saying why it was sent. Team e-mails
 * (3.8) are compact: who did what, a note, a navy button. Every e-mail renders
 * from here, so they all look alike.
 *
 * E-mail HTML: tables and inline styles only (Gmail, Outlook), 560 px wide,
 * PNG illustrations (no SVG in inboxes). Syne / Work Sans load where the client
 * allows web fonts, Arial elsewhere. A plain-text part mirrors every line.
 */

/** The illustrations, exported from the Paper boards to `public/email/`. */
export const EMAIL_ART = [
  'envelope',
  'lock',
  'booked',
  'refused',
  'recording',
  'next-steps',
  'calendar',
  'camera',
  'moved',
  'cancelled',
  'dossier',
  'file',
  'message',
  'signature',
  'invoice',
  'accompagne',
] as const;
export type EmailArt = (typeof EMAIL_ART)[number];

/**
 * Where the e-mail's images are served: always the public site, so they show
 * in any inbox, even for e-mails sent from a laptop or a preview.
 */
const ASSETS_ORIGIN = process.env.VERCEL_ENV === 'production' ? siteUrl() : 'https://www.stanzy-immigration-consulting.com';
export const emailAsset = (file: string): string => `${ASSETS_ORIGIN}/email/${file}`;

/** The card under the text. */
export type EmailCard =
  /** A slot: the calendar tile (« NOV. 25 »), its line and what it is; maybe rows under it. */
  | { kind: 'slot'; month: string; day: string; title: string; sub: string; rows?: EmailRow[] }
  /** Label / value lines (« Montant · 15 000 FCFA »). */
  | { kind: 'rows'; rows: EmailRow[] }
  /** A small label over a sentence: « ÉTAPE », « MOTIF », « MESSAGE » (a quote). */
  | { kind: 'note'; label: string; text: string; quote?: boolean }
  /** A file: the PDF tag, its name and what it is. */
  | { kind: 'file'; title: string; sub: string };

export type EmailRow = { label: string; value: string; tone?: 'big' | 'leaf' | 'rouge' };
export type EmailLink = { label: string; url: string };

export type BrandEmail = {
  to: string;
  subject: string;
  /** The small label at the top right: « CONSULTATION CONFIRMÉE ». */
  eyebrow: string;
  art?: EmailArt;
  /** The headline; without one, the text starts the e-mail. */
  title?: string;
  /** Paragraphs, in order. */
  lines: string[];
  card?: EmailCard;
  cta?: EmailLink;
  /** Small underlined links under the button. */
  links?: EmailLink[];
  /** The small print under the button (« Ce lien expire dans 1 heure… »). */
  note?: string;
  /** Why they get it: « Stanzy Immigration Consulting · e-mail de votre compte ». */
  footer: string;
  /** « Une question ? Répondez sur WhatsApp à Stanzy. » above the footer. */
  help?: string;
  attachments?: EmailMessage['attachments'];
};

const C = {
  page: '#F7F8FC',
  surface: '#FFFFFF',
  ink: '#0D1F4E',
  slate: '#4A5568',
  fog: '#E2E8F0',
  rouge: '#CC1627',
  rose: '#EE8A93',
  leaf: '#15803D',
  blush: '#FCEDEF',
  navy: '#0D1F4E',
};
const HEADING = "'Syne', 'Arial Black', Arial, sans-serif";
const BODY = "'Work Sans', Arial, Helvetica, sans-serif";
const LABEL = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif";

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
const e = escapeHtml;

function frame(subject: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Syne:wght@700;800&family=Work+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>@media (max-width:600px){.px{padding-left:24px!important;padding-right:24px!important}.title{font-size:24px!important;line-height:30px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${C.surface};border-radius:20px;overflow:hidden;border:1px solid ${C.fog};">
${inner}
</table>
</td></tr></table>
</body></html>`;
}

function header(eyebrow: string, small = false): string {
  const [w, h] = small ? [56, 42] : [72, 54];
  return `<tr><td class="px" style="padding:32px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${emailAsset('logo.png')}" width="${w}" height="${h}" alt="Stanzy Immigration Consulting" style="display:block;border:0;"></td>
<td align="right" style="vertical-align:middle;font-family:${LABEL};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.slate};">${e(eyebrow)}</td>
</tr></table></td></tr>`;
}

function rowsHtml(rows: EmailRow[], firstBorder: boolean): string {
  return rows
    .map((row, i) => {
      const value =
        row.tone === 'big'
          ? `font-family:${HEADING};font-size:20px;line-height:24px;font-weight:800;color:${C.ink};`
          : `font-family:${BODY};font-size:14px;line-height:20px;font-weight:700;color:${row.tone === 'leaf' ? C.leaf : row.tone === 'rouge' ? C.rouge : C.ink};`;
      const border = i > 0 || firstBorder ? `border-top:1px solid ${C.fog};` : '';
      return `<tr><td style="${border}padding:12px 18px;font-family:${BODY};font-size:14px;line-height:20px;color:${C.slate};">${e(row.label)}</td><td align="right" style="${border}padding:12px 18px;${value}">${e(row.value)}</td></tr>`;
    })
    .join('');
}

function cardHtml(card: EmailCard): string {
  const box = `width:100%;border:1px solid ${C.fog};border-radius:16px;border-collapse:separate;`;
  if (card.kind === 'slot') {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${box}">
<tr><td colspan="2" style="padding:16px 18px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:48px;height:52px;background:${C.navy};border-radius:8px;text-align:center;vertical-align:middle;">
<div style="font-family:${LABEL};font-size:10px;line-height:12px;font-weight:800;color:${C.rose};text-transform:uppercase;">${e(card.month)}</div>
<div style="font-family:${HEADING};font-size:20px;line-height:22px;font-weight:800;color:#FFFFFF;">${e(card.day)}</div></td>
<td style="padding-left:14px;vertical-align:middle;">
<div style="font-family:${BODY};font-size:16px;line-height:22px;font-weight:700;color:${C.ink};">${e(card.title)}</div>
<div style="font-family:${BODY};font-size:13px;line-height:18px;color:${C.slate};">${e(card.sub)}</div></td>
</tr></table></td></tr>${rowsHtml(card.rows ?? [], true)}</table>`;
  }
  if (card.kind === 'rows') return `<table role="presentation" cellpadding="0" cellspacing="0" style="${box}">${rowsHtml(card.rows, false)}</table>`;
  if (card.kind === 'file') {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${box}"><tr><td style="padding:14px 18px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:40px;height:46px;background:${C.blush};border-radius:8px;text-align:center;vertical-align:middle;font-family:${LABEL};font-size:11px;font-weight:800;color:${C.rouge};">PDF</td>
<td style="padding-left:14px;vertical-align:middle;"><div style="font-family:${BODY};font-size:15px;line-height:20px;font-weight:700;color:${C.ink};">${e(card.title)}</div>
<div style="font-family:${BODY};font-size:13px;line-height:18px;color:${C.slate};">${e(card.sub)}</div></td></tr></table></td></tr></table>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${box}"><tr><td style="padding:14px 18px;">
<div style="font-family:${LABEL};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.slate};">${e(card.label)}</div>
<div style="padding-top:4px;font-family:${BODY};font-size:15px;line-height:22px;${card.quote ? 'font-style:italic;' : 'font-weight:700;'}color:${C.ink};">${e(card.quote ? `« ${card.text} »` : card.text)}</div>
</td></tr></table>`;
}

const block = (html: string, top = 18) => `<tr><td class="px" style="padding:${top}px 40px 0;">${html}</td></tr>`;

function button(cta: EmailLink, color: string, height: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${color};border-radius:999px;">
<a href="${e(cta.url)}" style="display:block;padding:${(height - 20) / 2}px 24px;font-family:${HEADING};font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;">${e(cta.label)}</a></td></tr></table>`;
}

function footerHtml(footer: string, help?: string): string {
  const line = (text: string) => `<div style="font-family:${BODY};font-size:12px;line-height:18px;color:${C.slate};">${e(text)}</div>`;
  return `<tr><td class="px" align="center" style="background:${C.page};padding:20px 40px 28px;text-align:center;">${help ? line(help) : ''}${help ? '<div style="height:6px;line-height:6px;">&nbsp;</div>' : ''}${line(footer)}</td></tr>`;
}

function plainText(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join('\n\n');
}

function cardText(card: EmailCard): string {
  // « · » between a label and its value reads the same in French and English.
  if (card.kind === 'slot') return [`${card.title} · ${card.sub}`, ...(card.rows ?? []).map((r) => `${r.label} · ${r.value}`)].join('\n');
  if (card.kind === 'rows') return card.rows.map((r) => `${r.label} · ${r.value}`).join('\n');
  if (card.kind === 'file') return `${card.title} · ${card.sub}`;
  return `${card.label} · ${card.quote ? `« ${card.text} »` : card.text}`;
}

/** A Client's e-mail (boards 3.1–3.7). */
export function brandEmail(mail: BrandEmail): EmailMessage {
  const centered = Boolean(mail.title);
  const align = centered ? 'center' : 'left';
  const paragraphs = mail.lines
    // Under a title the text is slate and centred; a plain letter (the partner's, board 3.9) is ink, left.
    .map((line) => `<p style="margin:0 0 10px;font-family:${BODY};font-size:16px;line-height:25px;color:${centered ? C.slate : C.ink};text-align:${align};">${e(line)}</p>`)
    .join('');
  const inner = [
    header(mail.eyebrow),
    mail.art
      ? block(`<div style="text-align:center;"><img src="${emailAsset(`${mail.art}.png`)}" width="150" height="150" alt="" style="display:inline-block;border:0;width:150px;height:150px;"></div>`)
      : '',
    mail.title
      ? block(
          `<h1 class="title" style="margin:0;font-family:${HEADING};font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.02em;color:${C.ink};text-align:center;">${e(mail.title)}</h1>`,
        )
      : '',
    block(paragraphs, 14),
    mail.card ? block(cardHtml(mail.card), 8) : '',
    mail.cta ? block(button(mail.cta, C.rouge, 54)) : '',
    mail.links?.length
      ? block(
          `<div style="text-align:center;font-family:${BODY};font-size:14px;line-height:20px;">${mail.links
            .map((link) => `<a href="${e(link.url)}" style="color:${C.ink};font-weight:600;text-decoration:underline;margin:0 10px;">${e(link.label)}</a>`)
            .join('')}</div>`,
          16,
        )
      : '',
    mail.note
      ? block(`<p style="margin:0;font-family:${BODY};font-size:13px;line-height:19px;color:${C.slate};text-align:center;">${e(mail.note)}</p>`, 16)
      : '',
    '<tr><td style="height:28px;line-height:28px;">&nbsp;</td></tr>',
    footerHtml(mail.footer, mail.help),
  ].join('\n');

  return {
    to: mail.to,
    subject: mail.subject,
    html: frame(mail.subject, inner),
    text: plainText([
      mail.title,
      ...mail.lines,
      mail.card && cardText(mail.card),
      mail.cta && `${mail.cta.label}\n${mail.cta.url}`,
      ...(mail.links ?? []).map((link) => `${link.label}\n${link.url}`),
      mail.note,
      mail.help,
      mail.footer,
    ]),
    ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
  };
}

/** A team e-mail (board 3.8): who did what, the Client in a header, a note, a navy button. */
export function teamEmail(mail: {
  to: string;
  subject: string;
  /** The Client: initials, name, and what it is about (« Accompagnement Entrée Express »). */
  person: { name: string; context: string };
  /** The small tag at the right: « Demande d'intérêt », « Facture »… */
  tag: string;
  lines: string[];
  /** The quoted or labelled line: a comment, a file, a level. */
  note?: { label?: string; text: string; quote?: boolean };
  cta: EmailLink;
  attachments?: EmailMessage['attachments'];
}): EmailMessage {
  const initials = mail.person.name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const inner = [
    `<tr><td class="px" style="padding:24px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;vertical-align:middle;"><div style="width:36px;height:36px;border-radius:999px;background:#E8EDF5;text-align:center;font-family:${LABEL};font-size:13px;line-height:36px;font-weight:800;color:${C.ink};">${e(initials)}</div></td>
<td style="padding-left:12px;vertical-align:middle;"><div style="font-family:${BODY};font-size:15px;line-height:20px;font-weight:700;color:${C.ink};">${e(mail.person.name)}</div>
<div style="font-family:${BODY};font-size:13px;line-height:18px;color:${C.slate};">${e(mail.person.context)}</div></td>
<td align="right" style="vertical-align:middle;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#EEF2FF;font-family:${LABEL};font-size:11px;line-height:14px;font-weight:700;color:#4338CA;">${e(mail.tag)}</span></td>
</tr></table></td></tr>`,
    `<tr><td class="px" style="padding:16px 28px 0;">${mail.lines
      .map((line) => `<p style="margin:0 0 10px;font-family:${BODY};font-size:15px;line-height:23px;color:${C.ink};">${e(line)}</p>`)
      .join('')}</td></tr>`,
    mail.note
      ? `<tr><td class="px" style="padding:4px 28px 0;"><div style="border-left:3px solid #4338CA;background:${C.page};border-radius:8px;padding:12px 14px;font-family:${BODY};font-size:14px;line-height:21px;color:${C.ink};">${mail.note.label ? `<b>${e(mail.note.label)}</b> · ` : ''}${e(mail.note.quote ? `« ${mail.note.text} »` : mail.note.text)}</div></td></tr>`
      : '',
    `<tr><td class="px" style="padding:16px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${C.navy};border-radius:999px;"><a href="${e(mail.cta.url)}" style="display:inline-block;padding:11px 22px;font-family:${HEADING};font-size:14px;line-height:18px;font-weight:700;color:#FFFFFF;text-decoration:none;">${e(mail.cta.label)}</a></td></tr></table></td></tr>`,
  ].join('\n');
  return {
    to: mail.to,
    subject: mail.subject,
    html: frame(mail.subject, inner),
    text: plainText([
      `${mail.person.name} · ${mail.person.context}`,
      ...mail.lines,
      mail.note && `${mail.note.label ? `${mail.note.label} · ` : ''}${mail.note.quote ? `« ${mail.note.text} »` : mail.note.text}`,
      `${mail.cta.label}\n${mail.cta.url}`,
    ]),
    ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
  };
}

/** A slot card's tile and lines: « NOV. » « 25 », « Mercredi · 09:00 – 09:45 ». */
export function slotParts(startsAt: Date, minutes: number, locale: 'fr' | 'en'): { month: string; day: string; title: string } {
  const intl = locale === 'fr' ? 'fr-FR' : 'en-CA';
  const zone = { timeZone: 'Africa/Douala' } as const;
  const end = new Date(startsAt.getTime() + minutes * 60_000);
  const time = (d: Date) => new Intl.DateTimeFormat(intl, { ...zone, hour: '2-digit', minute: '2-digit' }).format(d);
  const weekday = new Intl.DateTimeFormat(intl, { ...zone, weekday: 'long', day: 'numeric', month: 'long' }).format(startsAt);
  return {
    month: new Intl.DateTimeFormat(intl, { ...zone, month: 'short' }).format(startsAt).toUpperCase(),
    day: new Intl.DateTimeFormat(intl, { ...zone, day: 'numeric' }).format(startsAt),
    title: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${time(startsAt)} – ${time(end)}`,
  };
}
