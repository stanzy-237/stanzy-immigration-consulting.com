// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { CrsView } from '@/features/crs/views/crs-view';

/** Seam: the Calculateur CRS page as a visitor reads it — here the « À savoir » band. */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));
vi.mock('@/trpc/react', () => ({
  api: {
    useUtils: () => ({ crs: { list: { invalidate: vi.fn() } } }),
    crs: {
      save: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, isError: false }) },
      list: { useQuery: () => ({ data: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
      rename: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

beforeEach(() => {
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
});

const guide = () => screen.getByRole('region', { name: 'Un bon score CRS n’est que la première étape.' });

describe('CrsView — À savoir', () => {
  it('explains the next steps, offers Stanzy’s support and points to the 67-points check', () => {
    render(withIntl(<CrsView />));

    expect(within(guide()).getByText(/preuves de votre expérience professionnelle qualifiée/)).toBeInTheDocument();
    expect(within(guide()).getByText(/preuve de fonds suffisants/)).toBeInTheDocument();
    expect(within(guide()).getByText(/Stanzy Immigration vous accompagne/)).toBeInTheDocument();
    expect(within(guide()).getByRole('link', { name: 'Réserver une consultation' })).toBeInTheDocument();
    expect(within(guide()).getByRole('link', { name: 'Vérifier mon admissibilité (67 points)' })).toHaveAttribute(
      'href',
      '/outils/67-points',
    );
  });

  it('promotes the WhatsApp channel with its logo', () => {
    render(withIntl(<CrsView />));

    expect(within(guide()).getByRole('link', { name: /Rejoindre la chaîne WhatsApp/ })).toHaveAttribute(
      'href',
      expect.stringContaining('whatsapp.com/channel/'),
    );
    expect(within(guide()).getByRole('img', { name: 'WhatsApp' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    render(withIntl(<CrsView />));
    expect(await axe(guide())).toHaveNoViolations();
  });
});
