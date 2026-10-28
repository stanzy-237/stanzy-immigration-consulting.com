import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireConsultant, requireSession } from '@/features/auth/server/guards';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import { getCurrentSession } from '@/server/auth/session';

/**
 * Seam: the page guards that layouts and pages call. The session lookup (the
 * database boundary) is stubbed; Next's real `redirect` runs, so the test
 * reads where the person was sent from the thrown redirect.
 */
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/server/auth/session', () => ({ getCurrentSession: vi.fn() }));

const session = vi.mocked(getCurrentSession);

const SIGNED_IN = sessionFor();

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

describe('requireConsultant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a signed-out visitor to Connexion, returning to the Tableau de bord afterwards', async () => {
    session.mockResolvedValue(null);
    expect(await redirectedTo(requireConsultant({ locale: 'fr', next: '/tableau-de-bord' }))).toBe(
      '/fr/connexion?next=%2Ftableau-de-bord',
    );
  });

  it('answers 404 to a signed-in Account that is not the consultant, so the area is not advertised', async () => {
    session.mockResolvedValue(sessionFor({ status: 'CLIENT' }));
    await expect(requireConsultant({ locale: 'fr', next: '/tableau-de-bord' })).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it('returns the consultant’s session', async () => {
    const consultant = sessionFor({ role: 'CONSULTANT' });
    session.mockResolvedValue(consultant);
    await expect(requireConsultant({ locale: 'fr', next: '/tableau-de-bord' })).resolves.toBe(consultant);
  });
});
