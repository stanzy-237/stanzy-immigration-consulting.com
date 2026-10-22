import { requireSession } from '@/features/auth/server/guards';
import type { LocaleParams } from '@/i18n/routing';

// Everything under /compte needs a signed-in Account. The proxy only checks
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
  await requireSession({ locale, next: '/compte' });
  return children;
}
