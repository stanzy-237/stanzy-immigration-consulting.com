// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';

/** Seam: the Tableau de bord's frame on a wide screen, on the Factures section. */
vi.mock('next/navigation', () => ({ useSelectedLayoutSegments: () => ['factures', 'inv_1'] }));
vi.mock('@/features/shared/components/notification-bell', () => ({ NotificationBell: () => null }));

const shell = (defaultOpen = true) =>
  render(
    withIntl(
      <DashboardShell name="Stanzy" siteUrl="https://stanzy.test/fr" defaultOpen={defaultOpen}>
        <p>Page</p>
      </DashboardShell>,
    ),
  );

describe('DashboardShell', () => {
  it('lists the sections under their groups and marks the current one', async () => {
    const { container } = shell();
    const nav = screen.getByRole('navigation', { name: 'Sections du tableau de bord' });
    for (const group of ['Général', 'Clients', 'Facturation', 'Contenus']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Factures' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dossiers' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Comptes' })).toHaveAttribute('href', '/comptes');
    expect(screen.getByRole('link', { name: 'Voir le site' })).toHaveAttribute('href', 'https://stanzy.test/fr');
    expect(screen.getByText('Bonjour Stanzy')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('folds down to its icons and remembers it', () => {
    shell();
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    fireEvent.click(screen.getByRole('button', { name: 'Afficher ou replier le menu' }));
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('opens folded when the consultant left it so', () => {
    shell(false);
    expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute('data-state', 'collapsed');
  });
});

describe('DashboardShell on a phone', () => {
  it('keeps the bottom drawer: the menu button opens it, choosing a section closes it', async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    try {
      shell();
      expect(document.querySelector('[data-slot="sidebar"]')).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Afficher ou replier le menu' }));
      const drawer = await screen.findByRole('dialog', { name: 'Tableau de bord' });
      const factures = within(drawer).getByRole('link', { name: 'Factures' });
      expect(factures).toHaveAttribute('aria-current', 'page');
      expect(within(drawer).getByText('Facturation')).toBeInTheDocument();
      fireEvent.click(within(drawer).getByRole('link', { name: 'Comptes' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    }
  });
});
