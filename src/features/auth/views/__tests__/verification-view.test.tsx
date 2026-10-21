// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { VerificationView } from '@/features/auth/views/verification-view';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { sendVerificationEmail: vi.fn() },
}));

const resend = vi.mocked(authClient.sendVerificationEmail);

describe('VerificationView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('after sign-up, tells the person which inbox to check and can resend the link', async () => {
    resend.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(withIntl(<VerificationView email="aminata@example.com" />));

    expect(
      screen.getByRole('heading', { name: 'Vérifiez votre boîte de réception' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/aminata@example\.com/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer l’e-mail' }));
    expect(
      await screen.findByText('E-mail renvoyé. Pensez à vérifier vos courriers indésirables.'),
    ).toBeInTheDocument();
    expect(resend).toHaveBeenCalledWith({
      email: 'aminata@example.com',
      callbackURL: '/fr/verification?status=verified',
    });
  });

  it('confirms a followed link and lets the signed-in person continue', () => {
    render(withIntl(<VerificationView status="verified" />));
    expect(screen.getByRole('heading', { name: 'Adresse confirmée' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuer' })).toHaveAttribute('href', '/');
  });

  it('explains an invalid or expired link and points to Connexion', () => {
    render(withIntl(<VerificationView error="token_expired" />));
    expect(
      screen.getByRole('heading', { name: 'Lien invalide ou expiré' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la connexion' })).toHaveAttribute(
      'href',
      '/connexion',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<VerificationView email="a@example.com" />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
