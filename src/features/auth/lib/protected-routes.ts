/**
 * Locale-less path prefixes that need a signed-in Account. The proxy sends
 * signed-out visitors from these to Connexion; each prefix's layout does the
 * authoritative session check. Later: `/coffre-fort`.
 */
export const PROTECTED_PREFIXES = ['/compte', '/mon-espace', '/outils/timeline', '/tableau-de-bord'] as const;

/** Open to visitors though under a protected prefix: « Compte » shows them Connexion / Créer un compte (`PWA · Visiteur · 3`). */
const OPEN_PATHS = new Set(['/compte']);

/** True for a protected prefix itself or anything below it (not lookalikes). */
export function isProtectedPath(pathname: string): boolean {
  if (OPEN_PATHS.has(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The Connexion page for `locale`, returning to `next` after sign-in. */
export function connexionPathFor(locale: string, next: string): string {
  return `/${locale}/connexion?${new URLSearchParams({ next })}`;
}
