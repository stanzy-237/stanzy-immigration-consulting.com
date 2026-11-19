// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierFinancesView } from '@/features/finances/views/dossier-finances-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: a Dossier's finances on its page (#95, #158), the query in the cache as the route prefetches it. */
const api = vi.hoisted(() => ({ setDossierPricing: vi.fn(), setRequestPricing: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  api.setDossierPricing.mockReturnValue({ ok: true });
  api.setRequestPricing.mockReturnValue({ ok: true });
});

// Alexia's Dossier: her Accompagnement, and a certificat de police negotiated with her, the partner's price from the catalogue.
const base = {
  income: 80_000,
  charges: 10_000,
  net: 70_000,
  unconverted: false,
  service: 'ACCOMPAGNEMENT',
  lines: [
    { kind: 'DOSSIER', id: 'dos_1', name: null, price: 100_000, priceSource: 'CONTRACT', partnerPrice: null, partnerSource: null },
    {
      kind: 'REQUEST',
      id: 'req_police',
      name: { fr: 'Certificat de police', en: 'Police certificate' },
      price: 25_000,
      priceSource: 'TYPED',
      partnerPrice: 15_000,
      partnerSource: 'CATALOGUE',
    },
  ],
  price: 125_000,
  partnerPrice: 15_000,
  balance: { price: 125_000, invoiced: 80_000, paid: 80_000, remaining: 45_000, toInvoice: 45_000 },
  profit: 100_000,
};

function view(data: Record<string, unknown> = base) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'finances.dossier': () => data,
    'finances.setDossierPricing': (input) => api.setDossierPricing(input),
    'finances.setRequestPricing': (input) => api.setRequestPricing(input),
  });
  queryClient.setQueryData(trpc.finances.dossier.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierFinancesView dossierId="dos_1" />)));
}

const figure = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling;

describe('a Dossier’s finances (#158)', () => {
  it('lists each service sold with its agreed price and its partner’s, the Bénéfice and what is left to pay', async () => {
    const { container } = view();
    const police = screen.getByText('Certificat de police').closest('li')!;
    expect(figure(police, 'Prix convenu')).toHaveTextContent('25 000 FCFA (négocié)');
    expect(figure(police, 'Prix du partenaire')).toHaveTextContent('15 000 FCFA (du catalogue)');
    const own = screen.getByText('Accompagnement Entrée Express').closest('li')!;
    expect(figure(own, 'Prix convenu')).toHaveTextContent('100 000 FCFA (du contrat)');

    const section = screen.getByRole('region', { name: 'Finances du dossier' });
    expect(figure(section, 'Bénéfice')).toHaveTextContent('100 000 FCFA');
    expect(figure(screen.getByLabelText('Solde du service'), 'Reste à payer')).toHaveTextContent('45 000 FCFA');
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('saves the partner’s price negotiated for one request, and refuses an amount that isn’t one', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les prix : Certificat de police' }));
    const form = screen.getByRole('form', { name: 'Modifier les prix : Certificat de police' });
    // Typed figures start the fields; a prefilled one stays a placeholder.
    expect(within(form).getByLabelText('Prix convenu')).toHaveValue('25000');
    const partner = within(form).getByLabelText('Prix du partenaire');
    expect(partner).toHaveValue('');
    expect(partner).toHaveAttribute('placeholder', '15000');

    fireEvent.change(partner, { target: { value: 'quinze mille' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(form).findByRole('alert')).toBeInTheDocument();
    expect(api.setRequestPricing).not.toHaveBeenCalled();

    fireEvent.change(partner, { target: { value: '12 000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.setRequestPricing).toHaveBeenCalledWith({ requestId: 'req_police', price: 25_000, partnerPrice: 12_000 }),
    );
    expect(api.setDossierPricing).not.toHaveBeenCalled();
  }, 30_000);

  it('edits the Dossier’s own service apart from its requests, with no partner price', async () => {
    view();
    const own = screen.getByText('Accompagnement Entrée Express').closest('li')!;
    expect(within(own).queryByText('Prix du partenaire')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les prix : Accompagnement Entrée Express' }));
    const form = screen.getByRole('form', { name: 'Modifier les prix : Accompagnement Entrée Express' });
    expect(within(form).queryByLabelText('Prix du partenaire')).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Prix convenu'), { target: { value: '90000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.setDossierPricing).toHaveBeenCalledWith({ dossierId: 'dos_1', price: 90_000 }));
  }, 30_000);

  it('says how to follow the balance when nothing is priced', () => {
    view({ ...base, lines: [], price: null, partnerPrice: 0, balance: null, profit: null });
    expect(screen.getByText('Aucun service vendu sur ce dossier pour l’instant.')).toBeInTheDocument();
    expect(screen.getByText(/Aucun prix du service/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Solde du service')).not.toBeInTheDocument();
  });
});
