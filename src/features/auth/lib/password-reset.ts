/**
 * Where the emailed reset link lands: Réinitialiser le mot de passe, in the
 * locale the person asked from. Better Auth appends `?token=…` for a live
 * link, or `?error=INVALID_TOKEN` for a used or expired one.
 */
export function resetPasswordRedirectTo(locale: string): string {
  return `/${locale}/reinitialiser-mot-de-passe`;
}
