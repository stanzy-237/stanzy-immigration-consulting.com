import { Resend } from 'resend';

/**
 * A transactional email, already rendered. `text` is required so every email
 * reads in plain-text clients and so tests can pull links out of it.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * The one way the server sends email. Auth uses it for verification and
 * password-reset links; notifications (#17) extend it rather than adding a
 * second sender.
 */
export type Mailer = {
  send(message: EmailMessage): Promise<void>;
};

/**
 * Sends through Resend when an API key is configured. Without one (local dev,
 * previews without email set up) it logs the message instead, so links can be
 * followed from the terminal.
 */
export function createMailer(opts: {
  apiKey: string | undefined;
  from: string;
}): Mailer {
  if (!opts.apiKey) {
    return {
      async send(message) {
        console.info(
          `[mailer] (no RESEND_API_KEY) to=${message.to} subject="${message.subject}"\n${message.text}`,
        );
      },
    };
  }

  const resend = new Resend(opts.apiKey);
  return {
    async send(message) {
      const { error } = await resend.emails.send({ from: opts.from, ...message });
      if (error) {
        throw new Error(`Resend failed to send "${message.subject}": ${error.message}`);
      }
    },
  };
}
