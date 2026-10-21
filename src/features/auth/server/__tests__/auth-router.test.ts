import { describe, expect, it } from 'vitest';

import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `auth` tRPC router through a server-side caller, with the session
 * the request context would have resolved from the cookie.
 */
function callerAs(session: CurrentSession | null) {
  const ctx = {
    prisma: {} as TRPCContext['prisma'],
    headers: new Headers(),
    session,
  } satisfies TRPCContext;
  return createCaller(ctx);
}

const SIGNED_IN: CurrentSession = {
  account: {
    id: 'acc_1',
    name: 'Aminata Diallo',
    email: 'aminata@example.com',
    emailVerified: true,
    image: null,
    locale: 'fr',
  },
  session: { id: 'ses_1', expiresAt: new Date('2026-11-01T00:00:00Z') },
};

describe('auth.me', () => {
  it('returns null when nobody is signed in', async () => {
    expect(await callerAs(null).auth.me()).toBeNull();
  });

  it('returns the signed-in Account summary', async () => {
    expect(await callerAs(SIGNED_IN).auth.me()).toEqual({
      id: 'acc_1',
      name: 'Aminata Diallo',
      email: 'aminata@example.com',
      image: null,
      locale: 'fr',
    });
  });
});
