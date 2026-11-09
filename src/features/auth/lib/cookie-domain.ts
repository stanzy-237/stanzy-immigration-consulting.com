/**
 * Reads `AUTH_COOKIE_DOMAIN` as a cookie `Domain`: trimmed, lower-cased,
 * without leading or trailing dots. Chrome drops a cookie whose Domain ends
 * with a dot (Safari does not), so `stanzy-immigration-consulting.com.` once
 * broke every sign-in on Android. Empty after cleaning reads as unset.
 */
export function toCookieDomain(raw: string | undefined): string | undefined {
  const domain = raw?.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  return domain || undefined;
}
