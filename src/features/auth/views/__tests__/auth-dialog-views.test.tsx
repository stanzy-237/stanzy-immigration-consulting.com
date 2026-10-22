// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { ConnexionDialogView } from '@/features/auth/views/connexion-dialog-view';
import { InscriptionDialogView } from '@/features/auth/views/inscription-dialog-view';

import { router, withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    sendVerificationEmail: vi.fn(),
  },
}));

describe('ConnexionDialogView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens Connexion as a dialog over the current page', async () => {
    render(withIntl(<ConnexionDialogView />));
    const dialog = await screen.findByRole('dialog', { name: 'Connexion' });
    expect(within(dialog).getByLabelText('Adresse e-mail')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      '/inscription',
    );
  });

  it('closes by going back to the page underneath', async () => {
    render(withIntl(<ConnexionDialogView />));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('leaves the person on the page they were on once signed in', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<ConnexionDialogView />));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Adresse e-mail'), {
      target: { value: 'aminata@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Mot de passe'), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    // No server re-render: the nav picks up the new session on its own.
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('goes on to next once signed in, when Connexion was opened with one', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never);
    render(withIntl(<ConnexionDialogView next="/compte" />));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Adresse e-mail'), {
      target: { value: 'aminata@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Mot de passe'), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/compte'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    render(withIntl(<ConnexionDialogView />));
    expect(await axe(await screen.findByRole('dialog'))).toHaveNoViolations();
  });
});

describe('InscriptionDialogView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens Inscription as a dialog with a link across to Connexion', async () => {
    render(withIntl(<InscriptionDialogView />));
    const dialog = await screen.findByRole('dialog', { name: 'Créer votre compte' });
    expect(within(dialog).getByLabelText('Nom complet')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion',
    );
  });

  it('has no axe violations', async () => {
    render(withIntl(<InscriptionDialogView />));
    expect(await axe(await screen.findByRole('dialog'))).toHaveNoViolations();
  });
});
