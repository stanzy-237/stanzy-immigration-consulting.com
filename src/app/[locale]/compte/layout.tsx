import { headers } from 'next/headers';

import { requireClient } from '@/features/auth/server/guards';
import { getCurrentSession } from '@/server/auth/session';
import type { LocaleParams } from '@/i18n/routing';

// /compte itself is open (visitors see « Compte »); the rest needs a signed-in Account. The proxy only checks
// that a session cookie exists; this is the authoritative check. Layouts don't
// see the full path, so a stale-cookie visitor returns to /compte after
// signing in.
export default async function CompteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LocaleParams;
}) {
  const { locale } = await params;
  // Signed out: the page shows « Compte » for visitors (Connexion / Créer un compte).
  if (!(await getCurrentSession(await headers()))) return children;
  // The consultant's settings live in the Tableau de bord, not here.
  await requireClient({ locale, next: '/compte', dashboardPath: '/' });
  return children;
}
