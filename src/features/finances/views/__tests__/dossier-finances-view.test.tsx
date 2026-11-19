// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierFinancesView } from '@/features/finances/views/dossier-finances-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: a Dossier's finances on its page (#95, #158), the query in the cache as the route prefetches it. */
const api = vi.hoisted(() => ({ setPricing: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const base = {
  income: 80_000,
  charges: 10_000,
  net: 70_000,
  unconverted: false,
  price: 100_000,
  priceSource: 'CONTRACT' as const,
  partnerShare: 30_000,
  partnerSource: 'CATALOGUE' as const,
  balance: { price: 100_000, invoiced: 80_000, paid: 80_000, remaining: 20_000, toInvoice: 20_000 },
  profit: 60_000,
};

function view(data: Record<string, unknown> = base) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'finances.dossier': () => data,
    'finances.setPricing': (input) => api.setPricing(input),
  });
  queryClient.setQueryData(trpc.finances.dossier.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierFinancesView dossierId="dos_1" />)));
}

const figure = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling;

describe('a Dossier’s finances (#158)', () => {
  it('shows the price, the partner’s share, the Bénéfice and what is left to pay', async () => {
    const { container } = view();
    const section = screen.getByRole('region', { name: 'Finances du dossier' });
    expect(figure(section, 'Prix du service')).toHaveTextContent('100 000 FCFA');
    expect(figure(section, 'Part du partenaire')).toHaveTextContent('30 000 FCFA');
    expect(figure(section, 'Bénéfice')).toHaveTextContent('60 000 FCFA');
    expect(figure(screen.getByLabelText('Solde du service'), 'Reste à payer')).toHaveTextContent('20 000 FCFA');
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('saves a new price and share, and refuses an amount that isn’t one', async () => {
    api.setPricing.mockReturnValue({ ok: true });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const price = screen.getByLabelText('Prix du service');
    expect(price).toHaveValue('100000');

    fireEvent.change(price, { target: { value: 'cent mille' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(api.setPricing).not.toHaveBeenCalled();

    fireEvent.change(price, { target: { value: '90 000' } });
    fireEvent.change(screen.getByLabelText('Part du partenaire'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.setPricing).toHaveBeenCalledWith({ dossierId: 'dos_1', servicePrice: 90_000, partnerShare: null }),
    );
  }, 30_000);

  it('says how to follow the balance when there is no price', () => {
    view({ ...base, price: null, priceSource: null, balance: null, profit: null });
    expect(screen.getByText(/Aucun prix du service/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Solde du service')).not.toBeInTheDocument();
  });
});
