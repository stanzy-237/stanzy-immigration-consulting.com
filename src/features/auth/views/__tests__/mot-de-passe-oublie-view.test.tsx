// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { MotDePasseOublieView } from '@/features/auth/views/mot-de-passe-oublie-view';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { requestPasswordReset: vi.fn() },
}));

const requestReset = vi.mocked(authClient.requestPasswordReset);

function submit(email = 'aminata@example.com', labels = { email: 'Adresse e-mail', submit: 'Envoyer le lien' }) {
  fireEvent.change(screen.getByLabelText(labels.email), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: labels.submit }));
}

describe('MotDePasseOublieView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for a reset link that comes back to Réinitialiser le mot de passe, then confirms', async () => {
    requestReset.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<MotDePasseOublieView />));

    submit();

    expect(
      await screen.findByRole('heading', { name: 'Vérifiez votre boîte de réception' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Si un compte Stanzy existe pour aminata@example\.com/),
    ).toBeInTheDocument();
    expect(requestReset).toHaveBeenCalledWith({
      email: 'aminata@example.com',
      redirectTo: '/fr/reinitialiser-mot-de-passe',
    });
  });

  it('works in English, with the link coming back to the English page', async () => {
    requestReset.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<MotDePasseOublieView />, 'en'));

    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
    submit('aminata@example.com', { email: 'Email address', submit: 'Send the link' });

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(requestReset).toHaveBeenCalledWith({
      email: 'aminata@example.com',
      redirectTo: '/en/reinitialiser-mot-de-passe',
    });
  });

  it('tells the person to slow down when rate-limited', async () => {
    requestReset.mockResolvedValue({ data: null, error: { status: 429 } } as never);
    render(withIntl(<MotDePasseOublieView />));

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans une minute.',
    );
    expect(screen.queryByRole('heading', { name: 'Vérifiez votre boîte de réception' })).toBeNull();
  });

  it('links back to Connexion', () => {
    render(withIntl(<MotDePasseOublieView />));
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/connexion');
  });

  it('has no axe violations, before and after sending', async () => {
    requestReset.mockResolvedValue({ data: { status: true }, error: null } as never);
    const { container } = render(withIntl(<MotDePasseOublieView />));
    expect(await axe(container)).toHaveNoViolations();

    submit();
    await screen.findByRole('heading', { name: 'Vérifiez votre boîte de réception' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
