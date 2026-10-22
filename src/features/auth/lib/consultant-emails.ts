import { z } from 'zod';

const email = z.string().email();

/**
 * Reads `CONSULTANT_EMAILS` (comma-separated). `emails` are lower-cased so
 * they match however the consultant types their address at sign-up;
 * `invalid` lists entries that are not email addresses.
 */
export function parseConsultantEmails(raw: string | undefined): {
  emails: string[];
  invalid: string[];
} {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    emails: entries.filter((e) => email.safeParse(e).success).map((e) => e.toLowerCase()),
    invalid: entries.filter((e) => !email.safeParse(e).success),
  };
}
