import { brandEmail } from '@/server/email/brand-email';
import type { EmailMessage } from '@/server/email/mailer';

/**
 * The hand-off to a service's partner (#148): the PDF the consultant put
 * together (the note, then the pieces), attached. In French: the partners
 * are in Cameroon. No button: the partner has no account. Board 3.9: plain
 * text under the logo, no illustration, the PDF shown as a file.
 */
export function handoffEmail(opts: {
  to: string;
  partner: string | null;
  client: string;
  service: string;
  pdf: Buffer;
  fileName: string;
}): EmailMessage {
  const lines = [
    opts.partner ? `Bonjour ${opts.partner},` : 'Bonjour,',
    `Veuillez trouver ci-joint le dossier de ${opts.client} pour le service « ${opts.service} » : notre note, puis les pièces.`,
    'Merci de nous confirmer sa bonne réception.',
    'L’équipe Stanzy Immigration Consulting',
  ];
  return brandEmail({
    to: opts.to,
    subject: `${opts.service} – ${opts.client}`,
    eyebrow: 'Service documentaire',
    lines,
    card: { kind: 'file', title: opts.fileName, sub: 'Note de Stanzy, puis les pièces' },
    footer: 'Stanzy Immigration Consulting',
    attachments: [{ filename: opts.fileName, content: opts.pdf }],
  });
}
