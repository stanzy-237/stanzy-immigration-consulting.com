// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AccountDashboardView, AccountsDashboardView } from '@/features/accounts/views/accounts-dashboard-view';
import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: « Comptes » as the consultant reads it, the list in the cache as the route prefetches it. */
const accounts = [
  {
    id: 'acc_2',
    name: 'Bob Martin',
    email: 'bob@example.com',
    status: 'USER',
    locale: 'en',
    createdAt: new Date('2026-11-01'),
  },
  {
    id: 'acc_1',
    name: 'Aminata Diallo',
    email: 'aminata@example.com',
    status: 'CLIENT',
    locale: 'fr',
    createdAt: new Date('2026-10-01'),
  },
];

describe('AccountsDashboardView', () => {
  it('lists the Accounts, each leading to its page, and filters by status', async () => {
    const { trpc, queryClient, wrap } = createTestTRPC({
      'accounts.dashboard.list': ({ status }) => {
        const shown = status === 'CLIENT' ? accounts.filter((a) => a.status === 'CLIENT') : accounts;
        return { accounts: shown, total: shown.length };
      },
    });
    queryClient.setQueryData(trpc.accounts.dashboard.list.queryKey({ query: '', status: 'ALL' }), {
      accounts,
      total: 2,
    } as never);
    const { container } = render(withIntl(wrap(<AccountsDashboardView />)));

    expect(screen.getByText('2 comptes')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Aminata Diallo' })[0]).toHaveAttribute('href', '/comptes/acc_1');
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Client' }));
    await waitFor(() => expect(screen.queryAllByRole('link', { name: 'Bob Martin' })).toHaveLength(0));
  }, 30_000);
});

describe('AccountDashboardView', () => {
  it('shows the Account’s Dossiers and opens a new one for it', () => {
    const { trpc, queryClient, wrap } = createTestTRPC({});
    queryClient.setQueryData(trpc.accounts.dashboard.get.queryKey({ id: 'acc_1' }), {
      ...accounts[1],
      dossiers: [
        { id: 'dos_1', service: 'ACCOMPAGNEMENT', stage: 'bassin', state: 'OPEN', createdAt: new Date('2026-10-20') },
      ],
    } as never);
    render(withIntl(wrap(<AccountDashboardView id="acc_1" />)));

    expect(screen.getByRole('link', { name: /Accompagnement Entrée Express/ })).toHaveAttribute(
      'href',
      '/dossiers/dos_1',
    );
    expect(screen.getByRole('link', { name: 'Ouvrir un dossier' })).toHaveAttribute(
      'href',
      '/dossiers/nouveau?account=acc_1',
    );
  });
});
