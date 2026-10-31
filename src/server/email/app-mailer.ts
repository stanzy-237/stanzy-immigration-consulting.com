import { env } from '@/lib/env';
import { createMailer } from '@/server/email/mailer';

/** The app's one mailer: Resend, or the console without an API key. */
export const appMailer = createMailer({
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM ?? 'Stanzy Immigration <onboarding@resend.dev>',
});
