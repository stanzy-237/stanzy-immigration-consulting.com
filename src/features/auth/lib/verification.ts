/**
 * Where Better Auth sends the person after they follow a verification link:
 * the Vérification view's "address confirmed" state, in their locale. On an
 * invalid or expired link Better Auth appends `&error=…` to the same URL.
 */
export function verifiedCallbackURL(locale: string): string {
  return `/${locale}/verification?status=verified`;
}
