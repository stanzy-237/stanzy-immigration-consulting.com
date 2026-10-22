// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { ReinitialiserMotDePasseView } from '@/features/auth/views/reinitialiser-mot-de-passe-view';

import { router, withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { resetPassword: vi.fn(), $store: { notify: vi.fn() } },
}));

const resetPassword = vi.mocked(authClient.resetPassword);
const notify = vi.mocked(authClient.$store.notify);

function submit(password: string, labels = { password: 'Nouveau mot de passe', submit: 'Enregistrer et me connecter' }) {
  fireEvent.change(screen.getByLabelText(labels.password), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: labels.submit }));
}

describe('ReinitialiserMotDePasseView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets the new password, refreshes the session and takes the signed-in person home', async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />));

    expect(
      screen.getByRole('heading', { name: 'Réinitialiser le mot de passe' }),
    ).toBeInTheDocument();
    submit('a-brand-new-password');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: 'a-brand-new-password',
      token: 'tok-123',
    });
    expect(notify).toHaveBeenCalledWith('$sessionSignal');
  });

  it('states that it does not recover the Coffre-fort passphrase', () => {
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />));
    expect(
      screen.getByText('Cela ne récupère pas la phrase secrète du Coffre-fort'),
    ).toBeInTheDocument();
    expect(screen.getByText(/personne, pas même Stanzy, ne peut rouvrir son contenu/)).toBeInTheDocument();
  });

  it('flags a password that is too short without calling the server', () => {
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />));

    submit('short-pw');

    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('aria-invalid', 'true');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('explains a used or expired link and offers to request a new one', () => {
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ error: 'INVALID_TOKEN' }} />));

    expect(screen.getByRole('heading', { name: 'Lien invalide ou expiré' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    );
    expect(screen.queryByLabelText('Nouveau mot de passe')).toBeNull();
  });

  it('treats a page opened without a token as an invalid link', () => {
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{}} />));
    expect(screen.getByRole('heading', { name: 'Lien invalide ou expiré' })).toBeInTheDocument();
  });

  it('switches to the invalid-link message when the link was used meanwhile', async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_TOKEN', status: 400 },
    } as never);
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />));

    submit('a-brand-new-password');

    expect(
      await screen.findByRole('heading', { name: 'Lien invalide ou expiré' }),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('works in English', async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />, 'en'));

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(
      screen.getByText('This does not recover your Coffre-fort passphrase'),
    ).toBeInTheDocument();
    submit('a-brand-new-password', { password: 'New password', submit: 'Save and log in' });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
  });

  it('shows the English invalid-link message', () => {
    render(withIntl(<ReinitialiserMotDePasseView searchParams={{ error: 'INVALID_TOKEN' }} />, 'en'));
    expect(screen.getByRole('heading', { name: 'Invalid or expired link' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('has no axe violations, with a live link or a dead one', async () => {
    const live = render(withIntl(<ReinitialiserMotDePasseView searchParams={{ token: 'tok-123' }} />));
    expect(await axe(live.container)).toHaveNoViolations();
    live.unmount();

    const dead = render(withIntl(<ReinitialiserMotDePasseView searchParams={{ error: 'INVALID_TOKEN' }} />));
    expect(await axe(dead.container)).toHaveNoViolations();
  });
});
