import type { EmailMessage } from '@/server/email/mailer';

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The hand-off to a service's partner (#148): the PDF the consultant put
 * together (the note, then the pieces), attached. In French: the partners
 * are in Cameroon. No button: the partner has no account.
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
  return {
    to: opts.to,
    subject: `${opts.service} – ${opts.client}`,
    text: lines.join('\n\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#0D1F4E;line-height:1.5">\n${lines
      .map((line) => `<p>${escape(line)}</p>`)
      .join('\n')}\n</div>`,
    attachments: [{ filename: opts.fileName, content: opts.pdf }],
  };
}
