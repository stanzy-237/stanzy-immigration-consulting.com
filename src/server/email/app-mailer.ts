import { env } from '@/lib/env';
import { createMailer } from '@/server/email/mailer';

const fallback = 'Stanzy Immigration <onboarding@resend.dev>';

/**
 * The app's mailers: Resend, or the console without an API key. Both use the
 * same API key, so it must be allowed to send from both domains.
 */

/** Dossiers, Factures, messages: EMAIL_FROM (the notifications. subdomain). */
export const appMailer = createMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM ?? fallback });

/** Account emails (verification, password reset): AUTH_EMAIL_FROM (the auth. subdomain), else EMAIL_FROM. */
export const accountMailer = createMailer({
  apiKey: env.RESEND_API_KEY,
  from: env.AUTH_EMAIL_FROM ?? env.EMAIL_FROM ?? fallback,
});
