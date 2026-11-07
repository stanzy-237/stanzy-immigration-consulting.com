// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { ChargesView } from '@/features/finances/views/charges-view';
import { FinancesOverviewView } from '@/features/finances/views/finances-overview-view';
import { IncomesView } from '@/features/finances/views/incomes-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Finances screens with their data in the cache, as the routes prefetch it. */
beforeEach(() => vi.clearAllMocks());

const months = Array.from({ length: 12 }, () => ({ income: 0, charges: 0, net: 0 }));

describe('the Finances overview', () => {
  it('shows the year in FCFA, the months missing a CAD rate and each Dossier’s margin', async () => {
    const data = {
      report: {
        year: 2026,
        total: { income: 450_000, charges: 150_000, net: 300_000 },
        months: months.map((month, index) => (index === 1 ? { income: 400_000, charges: 0, net: 400_000 } : month)),
        byService: [{ service: 'ACCOMPAGNEMENT', income: 400_000 }],
        byCategory: [{ category: 'Loyer', charges: 150_000 }],
        missingRates: ['2026-03'],
      },
      margins: [
        {
          dossierId: 'dos_1',
          income: 400_000,
          charges: 150_000,
          net: 250_000,
          dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT', account: { name: 'Aminata Diallo', email: 'a@x.com' } },
        },
      ],
    };
    const { trpc, queryClient, wrap } = createTestTRPC({ 'finances.overview': () => data });
    queryClient.setQueryData(trpc.finances.overview.queryKey({ year: 2026 }), data as never);
    const { container } = render(withIntl(wrap(<FinancesOverviewView year={2026} />)));

    expect(screen.getByRole('heading', { name: 'Finances' })).toBeInTheDocument();
    expect(screen.getByText(/Taux CAD manquant pour mars 2026/)).toBeInTheDocument();
    // Once in the phone's cards, once in the table (CSS picks which shows).
    for (const link of screen.getAllByRole('link', { name: 'Aminata Diallo' })) {
      expect(link).toHaveAttribute('href', '/dossiers/dos_1');
    }
    expect(screen.getByRole('link', { name: 'Exporter en CSV' })).toHaveAttribute(
      'href',
      '/api/finances/export?year=2026&locale=fr',
    );
    expect(screen.getByRole('link', { name: 'Année précédente' })).toHaveAttribute('href', '/finances?annee=2025');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('the Recettes', () => {
  it('shows a paid Facture as read only, and adds a Recette from a source', async () => {
    const create = vi.fn();
    const list = [
      {
        id: 'inv_1',
        amount: 400_000,
        currency: 'XAF',
        day: '2026-02-03',
        service: 'ACCOMPAGNEMENT',
        source: null,
        note: null,
        dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT', account: { name: 'Aminata Diallo', email: 'a@x.com' } },
        invoice: { id: 'inv_1', number: 'STZ-2026-0001' },
      },
    ];
    const { trpc, queryClient, wrap } = createTestTRPC({
      'finances.incomes.list': () => list,
      'finances.incomes.create': (input) => create(input) ?? { id: 'inc_1' },
    });
    queryClient.setQueryData(trpc.finances.incomes.list.queryKey({ year: 2026 }), list as never);
    const { container } = render(withIntl(wrap(<IncomesView year={2026} />)));

    expect(screen.getByRole('link', { name: 'Facture STZ-2026-0001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une recette' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Montant'), { target: { value: '50 000' } });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-03-10' } });
    fireEvent.change(within(dialog).getByLabelText('Service'), { target: { value: '' } });
    fireEvent.change(within(dialog).getByLabelText('Source'), { target: { value: 'Formation' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        amount: 50_000,
        currency: 'XAF',
        day: '2026-03-10',
        service: null,
        source: 'Formation',
        dossierId: null,
        note: null,
      }),
    );
  });
});

describe('the Charges', () => {
  it('adds a monthly Charge in an open category', async () => {
    const create = vi.fn();
    const categories = [
      { id: 'cat_rent', name: 'Loyer', archivedAt: null, _count: { charges: 0 } },
      { id: 'cat_old', name: 'Ancienne', archivedAt: new Date('2026-01-01'), _count: { charges: 2 } },
    ];
    const { trpc, queryClient, wrap } = createTestTRPC({
      'finances.charges.list': () => [],
      'finances.categories.list': () => categories,
      'finances.charges.create': (input) => create(input) ?? { id: 'chg_1' },
    });
    queryClient.setQueryData(trpc.finances.charges.list.queryKey({ year: 2026 }), [] as never);
    queryClient.setQueryData(trpc.finances.categories.list.queryKey(), categories as never);
    render(withIntl(wrap(<ChargesView year={2026} />)));

    expect(screen.getByText('Aucune charge en 2026.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une charge' }));
    const dialog = screen.getByRole('dialog');
    const category = within(dialog).getByLabelText('Catégorie');
    expect(within(category).queryByRole('option', { name: 'Ancienne' })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Montant'), { target: { value: '100000' } });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-01-05' } });
    fireEvent.click(within(dialog).getByLabelText(/Revient chaque mois/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        amount: 100_000,
        currency: 'XAF',
        day: '2026-01-05',
        categoryId: 'cat_rent',
        dossierId: null,
        note: null,
        repeatsMonthly: true,
      }),
    );
  });
});
