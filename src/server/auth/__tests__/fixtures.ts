import type { CurrentSession } from '@/server/auth/session';

/** A signed-in session as the request context resolves it: a verified User by default. */
export function sessionFor(account: Partial<CurrentSession['account']> = {}): CurrentSession {
  return {
    account: {
      id: 'acc_1',
      name: 'Aminata Diallo',
      email: 'aminata@example.com',
      emailVerified: true,
      image: null,
      locale: 'fr',
      status: 'USER',
      role: 'MEMBER',
      ...account,
    },
    session: { id: 'ses_1', expiresAt: new Date('2026-11-01T00:00:00Z') },
  };
}
