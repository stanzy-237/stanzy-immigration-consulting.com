// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { InscriptionView } from '@/features/auth/views/inscription-view';

import { router, withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { signUp: { email: vi.fn() } },
}));

const signUp = vi.mocked(authClient.signUp.email);

function fillAndSubmit(password = 'correct-horse-battery') {
  fireEvent.change(screen.getByLabelText('Nom complet'), {
    target: { value: 'Aminata Diallo' },
  });
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
    target: { value: 'aminata@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
}

describe('InscriptionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the Account in the current locale and sends the person to check their inbox', async () => {
    signUp.mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<InscriptionView />));

    fillAndSubmit();

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Aminata Diallo',
        email: 'aminata@example.com',
        password: 'correct-horse-battery',
        locale: 'fr',
        callbackURL: '/fr/verification?status=verified',
      }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/verification',
      query: { email: 'aminata@example.com' },
    });
  });

  it('shows the password rule live and blocks a too-short password before submitting', () => {
    render(withIntl(<InscriptionView />));
    expect(screen.getByText('10 caractères minimum')).toBeInTheDocument();

    fillAndSubmit('short-pw');

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a French message when the server refuses the sign-up', async () => {
    signUp.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL', status: 400, message: 'Invalid email' },
    } as never);
    render(withIntl(<InscriptionView />));

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette adresse e-mail n’est pas valide.',
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('tells the person to slow down when rate-limited', async () => {
    signUp.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests' },
    } as never);
    render(withIntl(<InscriptionView />));

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });

  it('links to Connexion for people who already have an Account', () => {
    render(withIntl(<InscriptionView />));
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion',
    );
  });

  it('carries next across to Connexion', () => {
    render(withIntl(<InscriptionView next="/compte" />));
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?next=%2Fcompte',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<InscriptionView />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
