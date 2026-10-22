// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { CompteView } from '@/features/auth/views/compte-view';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}));

describe('CompteView', () => {
  beforeEach(() => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { name: 'Aminata Diallo', email: 'aminata@example.com' } },
    } as never);
  });

  it('greets the signed-in Account on its protected home', () => {
    render(withIntl(<CompteView />));
    expect(screen.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeInTheDocument();
    expect(screen.getByText(/aminata@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/');
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<CompteView />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
