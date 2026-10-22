import type { AccountRole, AccountStatus } from '@/features/auth/lib/account-status';
import { toLocale, type Locale } from '@/i18n/routing';
import { auth } from '@/server/auth/auth';

/**
 * The signed-in Account and its session, as the rest of the app sees them.
 * Better Auth calls the person `user`; this boundary renames it to the
 * glossary's `account` so feature code never has to.
 */
export type CurrentSession = {
  account: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    locale: Locale;
    status: AccountStatus;
    role: AccountRole;
  };
  session: { id: string; expiresAt: Date };
};

/** Resolves the current session from request headers (the session cookie). */
export async function getCurrentSession(
  headers: Headers,
): Promise<CurrentSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;
  const { user, session } = result;
  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      locale: toLocale(user.locale),
      status: user.status as AccountStatus,
      role: user.role as AccountRole,
    },
    session: { id: session.id, expiresAt: session.expiresAt },
  };
}
