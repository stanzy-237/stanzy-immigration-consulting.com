// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { ConnexionView } from '@/features/auth/views/connexion-view';

import { router, withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn() }, sendVerificationEmail: vi.fn() },
}));

const signIn = vi.mocked(authClient.signIn.email);
const resend = vi.mocked(authClient.sendVerificationEmail);

function submit(password = 'correct-horse-battery') {
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
    target: { value: 'aminata@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('ConnexionView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signs the person in and takes them home', async () => {
    signIn.mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<ConnexionView />));

    submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'aminata@example.com',
        password: 'correct-horse-battery',
      }),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('returns the person to next once signed in', async () => {
    signIn.mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<ConnexionView next="/compte/securite?onglet=2fa" />));

    submit();

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/compte/securite?onglet=2fa'),
    );
  });

  it('takes the person home instead of to an off-site next', async () => {
    signIn.mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<ConnexionView next="//evil.com" />));

    submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
  });

  it('carries next across to Inscription', () => {
    render(withIntl(<ConnexionView next="/compte" />));
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      '/inscription?next=%2Fcompte',
    );
  });

  it('shows one generic message for a wrong email or password', async () => {
    signIn.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 },
    } as never);
    render(withIntl(<ConnexionView />));

    submit('wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou mot de passe incorrect.',
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('explains an unverified email and offers to resend the link', async () => {
    signIn.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', status: 403 },
    } as never);
    resend.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<ConnexionView />));

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirmez d’abord votre adresse e-mail',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Renvoyer l’e-mail de confirmation' }),
    );

    expect(
      await screen.findByText('E-mail envoyé. Vérifiez votre boîte de réception.'),
    ).toBeInTheDocument();
    expect(resend).toHaveBeenCalledWith({
      email: 'aminata@example.com',
      callbackURL: '/fr/verification?status=verified',
    });
  });

  it('tells the person to slow down when rate-limited', async () => {
    signIn.mockResolvedValue({ data: null, error: { status: 429 } } as never);
    render(withIntl(<ConnexionView />));

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });

  it('links to Inscription for people without an Account', () => {
    render(withIntl(<ConnexionView />));
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      '/inscription',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<ConnexionView />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
