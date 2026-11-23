// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PromoCodesView } from '@/features/consultation/views/promo-codes-view';
import { createTestTRPC, type Handlers } from '@/trpc/__tests__/test-utils';
import type { RouterOutputs } from '@/trpc/types';

const LIST: RouterOutputs['promoCodes']['list'] = {
  consultationPrice: 12_345,
  codes: [
    { id: 'a', code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70, services: ['CONSULTATION'], places: 20, used: 13, endsAt: new Date('2099-11-27T22:59:00Z'), oncePerAccount: true, status: 'ACTIVE' },
    { id: 'b', code: 'LANCEMENT', reductionType: 'PERCENT', reductionValue: 50, services: ['CONSULTATION'], places: 10, used: 10, endsAt: null, oncePerAccount: true, status: 'SOLD_OUT' },
  ],
};

function renderPage(handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'promoCodes.list': () => LIST, ...handlers });
  queryClient.setQueryData(trpc.promoCodes.list.queryKey(), LIST);
  return render(withIntl(wrap(<PromoCodesView />)));
}

/** The desktop form (the mobile sheet's copy only renders once opened). */
const form = () => within(screen.getByRole('region', { name: 'Nouveau code' }));

beforeEach(() => vi.clearAllMocks());

describe('PromoCodesView', () => {
  it('lists the codes with their places used, status and end', async () => {
    const { container } = renderPage();
    const list = within(screen.getByRole('region', { name: 'Vos codes promo' }));
    expect(list.getByText('BLACKFRIDAY')).toBeInTheDocument();
    expect(list.getAllByText('13 / 20').length).toBeGreaterThan(0);
    expect(list.getByText('Actif')).toBeInTheDocument();
    expect(list.getByText('Épuisé')).toBeInTheDocument();
    expect(list.getByText('Sans date de fin')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('makes a code, showing the price it gives at checkout', async () => {
    const create = vi.fn(() => ({ id: 'c', code: 'NOEL' }));
    renderPage({ 'promoCodes.create': create });
    fireEvent.change(form().getByLabelText('Code'), { target: { value: 'noel' } });
    fireEvent.change(form().getByLabelText('Pourcentage de réduction'), { target: { value: '20' } });
    expect(form().getByText(/9.?876 FCFA/)).toBeInTheDocument();
    fireEvent.change(form().getByLabelText('Nombre de places'), { target: { value: '50' } });
    fireEvent.change(form().getByLabelText('Fin'), { target: { value: '2026-12-31T23:59' } });
    fireEvent.click(form().getByRole('button', { name: 'Créer le code' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        code: 'NOEL',
        reductionType: 'PERCENT',
        reductionValue: 20,
        services: ['CONSULTATION'],
        places: 50,
        endsAt: new Date('2026-12-31T22:59:00Z'),
        oncePerAccount: true,
      }),
    );
  });

  it('refuses a free Consultation, and says when the name is taken', async () => {
    renderPage({
      'promoCodes.create': () => {
        throw new Error('PROMO_TAKEN');
      },
    });
    fireEvent.change(form().getByLabelText('Code'), { target: { value: 'BLACKFRIDAY' } });
    fireEvent.change(form().getByLabelText('Pourcentage de réduction'), { target: { value: '100' } });
    fireEvent.click(form().getByRole('button', { name: 'Créer le code' }));
    expect(form().getByRole('alert')).toHaveTextContent('Au plus 99 %');

    fireEvent.change(form().getByLabelText('Pourcentage de réduction'), { target: { value: '30' } });
    fireEvent.click(form().getByRole('button', { name: 'Créer le code' }));
    expect(await form().findByRole('alert')).toHaveTextContent('Un code actif porte déjà ce nom.');
  });

  it('deletes a code only once confirmed', async () => {
    const remove = vi.fn(() => ({ id: 'a' }));
    renderPage({ 'promoCodes.remove': remove });
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le code BLACKFRIDAY' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: 'a' }));
  });
});
