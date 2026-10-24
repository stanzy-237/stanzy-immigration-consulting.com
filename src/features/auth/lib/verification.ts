import { safeNextPath } from '@/features/auth/lib/safe-next-path';

/**
 * Where Better Auth sends the person after they follow a verification link:
 * the Vérification view's "address confirmed" state, in their locale, still
 * carrying the page they came from (`next`). On an invalid or expired link
 * Better Auth appends `&error=…` to the same URL.
 */
export function verifiedCallbackURL(locale: string, next?: unknown): string {
  const safe = safeNextPath(next);
  const back = safe === '/' ? '' : `&${new URLSearchParams({ next: safe })}`;
  return `/${locale}/verification?status=verified${back}`;
}
