/**
 * Whether `value` is a sender Resend accepts: `email@example.com` or
 * `Name <email@example.com>`. Checked at startup (src/lib/env.ts), so a wrong
 * EMAIL_FROM stops the app instead of failing every send.
 */
export function isEmailSender(value: string): boolean {
  const address = '[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+';
  return new RegExp(`^(?:${address}|[^<>@]+ <${address}>)$`).test(value.trim());
}
