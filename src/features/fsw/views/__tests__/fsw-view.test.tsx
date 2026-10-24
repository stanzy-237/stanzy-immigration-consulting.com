// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { FswView } from '@/features/fsw/views/fsw-view';

/**
 * Seam: the Calculateur 67 points page as a visitor reads it — here the
 * « À savoir » band beneath the calculator.
 */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));
vi.mock('@/trpc/react', () => ({
  api: { useUtils: () => ({}), crs: { list: { useQuery: () => ({ data: undefined }) } } },
}));

beforeEach(() => {
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
});

const guide = () => screen.getByRole('region', { name: 'Atteindre 67 points n’est que la première étape.' });

describe('FswView — À savoir', () => {
  it('lists what the application also needs and offers Stanzy’s support', () => {
    render(withIntl(<FswView />));

    expect(within(guide()).getByText(/preuves de votre expérience professionnelle qualifiée/)).toBeInTheDocument();
    expect(within(guide()).getByText(/preuve de fonds suffisants/)).toBeInTheDocument();
    expect(within(guide()).getByText(/Stanzy Immigration vous accompagne/)).toBeInTheDocument();
    expect(within(guide()).getByRole('link', { name: 'Réserver une consultation' })).toBeInTheDocument();
  });

  it('promotes the WhatsApp channel', () => {
    render(withIntl(<FswView />));

    const join = within(guide()).getByRole('link', { name: /Rejoindre la chaîne WhatsApp/ });
    expect(join).toHaveAttribute('href', expect.stringContaining('whatsapp.com/channel/'));
    expect(join).toHaveAttribute('target', '_blank');
    expect(join).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(guide()).getByRole('img', { name: 'WhatsApp' })).toHaveAttribute(
      'src',
      expect.stringContaining('whatsapp.svg'),
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<FswView />));
    expect(await axe(guide())).toHaveNoViolations();
    expect(container).toBeTruthy();
  });
});
