import { headers } from 'next/headers';
import { notFound, redirect as redirectToUrl } from 'next/navigation';

import { connexionPathFor } from '@/features/auth/lib/protected-routes';
import { safeNextPath, type NextParam } from '@/features/auth/lib/safe-next-path';
import { getCurrentSession, type CurrentSession } from '@/server/auth/session';

type GuardOptions = {
  locale: string;
  /** Where the person was headed (untrusted `?next=`, sanitized here). */
  next: NextParam;
};

/**
 * The authoritative "signed-in only" check for protected layouts. The proxy
 * already redirects visitors without a session cookie; this also catches an
 * expired or revoked session whose cookie is still around.
 */
export async function requireSession({ locale, next }: GuardOptions): Promise<CurrentSession> {
  const session = await getCurrentSession(await headers());
  if (!session) redirectToUrl(connexionPathFor(locale, safeNextPath(next)));
  return session;
}

/**
 * The Tableau de bord's check: signed in (else Connexion, like
 * `requireSession`) and the consultant. Anyone else gets the site's 404, so
 * the area isn't advertised to Users who stumble on its address.
 */
export async function requireConsultant(options: GuardOptions): Promise<CurrentSession> {
  const session = await requireSession(options);
  if (session.account.role !== 'CONSULTANT') notFound();
  return session;
}
