import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectIfSignedIn, requireSession } from '@/features/auth/server/guards';
import { getCurrentSession, type CurrentSession } from '@/server/auth/session';

/**
 * Seam: the page guards that layouts and pages call. The session lookup (the
 * database boundary) is stubbed; Next's real `redirect` runs, so the test
 * reads where the person was sent from the thrown redirect.
 */
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/server/auth/session', () => ({ getCurrentSession: vi.fn() }));

const session = vi.mocked(getCurrentSession);

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

/** Runs a guard and returns where it redirected to, or null if it didn't. */
async function redirectedTo(guard: Promise<unknown>): Promise<string | null> {
  try {
    await guard;
    return null;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) throw error;
    return digest.split(';')[2] ?? null;
  }
}

describe('requireSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a signed-out visitor to Connexion, returning to next afterwards', async () => {
    session.mockResolvedValue(null);
    expect(await redirectedTo(requireSession({ locale: 'en', next: '/compte' }))).toBe(
      '/en/connexion?next=%2Fcompte',
    );
  });

  it('returns the session of a signed-in Account', async () => {
    session.mockResolvedValue(SIGNED_IN);
    await expect(requireSession({ locale: 'fr', next: '/compte' })).resolves.toBe(SIGNED_IN);
  });
});

describe('redirectIfSignedIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets a signed-out visitor see the page', async () => {
    session.mockResolvedValue(null);
    expect(await redirectedTo(redirectIfSignedIn({ locale: 'fr', next: '/compte' }))).toBeNull();
  });

  it('sends a signed-in Account on to next, in the current locale', async () => {
    session.mockResolvedValue(SIGNED_IN);
    expect(
      await redirectedTo(redirectIfSignedIn({ locale: 'en', next: '/compte/securite' })),
    ).toBe('/en/compte/securite');
  });

  it('sends a signed-in Account home when next is missing or unsafe', async () => {
    session.mockResolvedValue(SIGNED_IN);
    expect(await redirectedTo(redirectIfSignedIn({ locale: 'fr', next: undefined }))).toBe('/fr');
    expect(
      await redirectedTo(redirectIfSignedIn({ locale: 'fr', next: '//evil.com' })),
    ).toBe('/fr');
  });
});
