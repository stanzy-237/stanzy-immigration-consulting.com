// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GoogleSignIn } from '@/features/auth/components/google-sign-in';
import { authClient } from '@/features/auth/lib/auth-client';
import { withIntl } from '@/features/auth/views/__tests__/test-utils';

vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

let query = new URLSearchParams();
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: () => query,
}));

const social = vi.mocked(authClient.signIn.social);

describe('GoogleSignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query = new URLSearchParams();
    vi.stubEnv('GOOGLE_SIGN_IN_ENABLED', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sends the person to Google, asking to come back to the destination', async () => {
    social.mockReturnValue(new Promise(() => {}) as never);
    render(withIntl(<GoogleSignIn callbackURL="/fr/outils" />));

    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/fr/outils',
      errorCallbackURL: '/fr/connexion',
    });
    expect(
      await screen.findByRole('button', { name: 'Redirection vers Google…' }),
    ).toBeDisabled();
  });

  it('explains when Google sign-in could not start', async () => {
    social.mockResolvedValue({ data: null, error: { status: 500 } } as never);
    render(withIntl(<GoogleSignIn callbackURL="/fr" />));

    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La connexion avec Google a échoué. Réessayez.',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeEnabled(),
    );
  });

  it('explains an unconfirmed Account with the same email when Google sends the person back', () => {
    query = new URLSearchParams({ error: 'account_not_linked' });
    render(withIntl(<GoogleSignIn callbackURL="/fr" />));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Un compte non confirmé utilise déjà cette adresse',
    );
  });

  it('reports any other Google failure generically', () => {
    query = new URLSearchParams({ error: 'access_denied' });
    render(withIntl(<GoogleSignIn callbackURL="/fr" />));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La connexion avec Google a échoué. Réessayez.',
    );
  });

  it('is hidden when Google sign-in is not configured', () => {
    vi.stubEnv('GOOGLE_SIGN_IN_ENABLED', '');
    const { container } = render(withIntl(<GoogleSignIn callbackURL="/fr" />));
    expect(container).toBeEmptyDOMElement();
  });

  it('has no axe violations', async () => {
    query = new URLSearchParams({ error: 'account_not_linked' });
    const { container } = render(withIntl(<GoogleSignIn callbackURL="/fr" />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
