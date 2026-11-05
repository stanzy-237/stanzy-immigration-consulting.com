// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierStanzyView } from '@/features/accompagnement/views/dossier-stanzy-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: « Documents à obtenir par Stanzy » on the consultant's Dossier, its requests in the cache. */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());

const request = (extra: Record<string, unknown> = {}) => ({
  id: 'stz_1',
  status: 'REQUESTED',
  declineNote: null,
  createdAt: new Date('2026-11-05T09:00:00Z'),
  acceptedAt: new Date('2026-11-05T09:00:00Z'),
  document: { id: 'doc_1', title: 'Lettre de la banque', section: { title: 'Preuve de fonds – Requérant principal' } },
  service: {
    id: 'svc_1',
    slug: 'preuve-de-fonds',
    name: { fr: 'Preuve de fonds', en: 'Proof of funds' },
    priceKind: 'PERCENT',
    price: 250,
    unit: { fr: 'du montant à justifier', en: 'of the amount to justify' },
  },
  contract: null,
  ...extra,
});

function panel(requests: unknown[], handlers: Record<string, (input: never) => unknown> = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'accompagnement.stanzy.forDossier': () => requests, ...handlers });
  queryClient.setQueryData(trpc.accompagnement.stanzy.forDossier.queryKey({ dossierId: 'dos_1' }), requests as never);
  return render(withIntl(wrap(<DossierStanzyView dossierId="dos_1" />)));
}

describe('« Documents à obtenir par Stanzy », for the consultant', () => {
  it('shows each request’s service and price', () => {
    panel([request()]);
    expect(screen.getByText('Preuve de fonds')).toBeInTheDocument();
    expect(screen.getByText(/2,5\s%/)).toBeInTheDocument();
    expect(screen.getByText(/conditions acceptées/)).toBeInTheDocument();
  });

  it('works the price out from the funds to justify, then sends the service’s contract', async () => {
    const accept = vi.fn();
    panel([request()], {
      'accompagnement.stanzy.accept': (input) => accept(input) ?? { contract: { id: 'ctr_9', number: 'CTR-2026-0009' }, invoiceId: 'inv_3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le contrat et la facture' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Montant à justifier (FCFA)'), { target: { value: '10000000' } });
    expect(within(dialog).getByLabelText('Prix (FCFA)')).toHaveValue('250000');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le contrat' }));
    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith({ id: 'stz_1', locale: 'fr', amount: 250_000, schedule: '100 % à la signature' }),
    );
    expect(await screen.findByText('Contrat CTR-2026-0009 envoyé ; ligne ajoutée à la facture brouillon')).toBeInTheDocument();
  });

  it('asks for the service first when none covers the document', () => {
    panel([request({ service: null })], { 'documentServices.dashboard.list': () => [] });
    expect(screen.getByText('Aucun service documentaire ne couvre encore ce document.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer le contrat et la facture' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Service documentaire pour « Lettre de la banque »')).toBeInTheDocument();
  });
});
