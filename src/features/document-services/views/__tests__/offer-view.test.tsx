// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { OfferView } from '@/features/document-services/views/offer-view';
import { ServiceProgressView } from '@/features/document-services/views/service-progress-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: a service's private link and a Dossier's service progress, with their data in the cache. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => vi.clearAllMocks());

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const pof = { ...STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds')!, id: 'svc_pof', price: 500 };

function offer(signedIn: boolean, order: unknown = null, send = vi.fn()) {
  const data = { service: pof, order };
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.orders.offer': () => data,
    'documentServices.orders.order': (input) => send(input) ?? { id: 'ord_1' },
  });
  queryClient.setQueryData(trpc.documentServices.orders.offer.queryKey({ token: TOKEN }), data as never);
  return render(withIntl(wrap(<OfferView token={TOKEN} signedIn={signedIn} />)));
}

describe('a service’s private link', () => {
  it('shows how Stanzy works and the price, and asks to sign in to order', async () => {
    const { container } = offer(false);
    expect(screen.getByRole('heading', { name: 'Preuve de fonds (vous avez les fonds)' })).toBeInTheDocument();
    expect(screen.getByText(/Compte en microfinance/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Se connecter pour commander/ }).getAttribute('href')).toContain(
      encodeURIComponent(`/services/offre/${TOKEN}`),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('signed in, orders once the conditions and contract are accepted', async () => {
    const send = vi.fn();
    offer(true, null, send);
    const button = screen.getByRole('button', { name: 'Commander ce service' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Un mot pour Stanzy/), { target: { value: '7 000 000 FCFA' } });
    fireEvent.click(screen.getByLabelText(/je commande ce service/));
    fireEvent.click(button);
    await waitFor(() => expect(send).toHaveBeenCalledWith({ token: TOKEN, note: '7 000 000 FCFA', accepted: true }));
  });

  it('shows an order waiting, or the Dossier once confirmed', () => {
    const { unmount } = offer(true, { id: 'ord_1', status: 'SUBMITTED', rejectNote: null, dossierId: null, createdAt: new Date() });
    expect(screen.getByRole('status')).toHaveTextContent('Commande envoyée');
    unmount();
    offer(true, { id: 'ord_1', status: 'APPROVED', rejectNote: null, dossierId: 'dos_1', createdAt: new Date() });
    expect(screen.getByRole('link', { name: 'Ouvrir mon dossier' })).toHaveAttribute('href', '/fr/mon-espace/dossiers/dos_1');
  });
});

describe('a Dossier’s service progress', () => {
  it('counts the days left to the due date, and leads to what is left to hand over', () => {
    vi.useFakeTimers({ now: new Date('2026-11-10T12:00:00Z'), toFake: ['Date'] });
    const data = [
      {
        id: 'stz_1',
        status: 'ACCEPTED',
        service: { name: pof.name },
        document: 'Lettre de la banque',
        startedOn: '2026-11-01',
        turnaroundDays: 21,
        dueOn: '2026-11-22',
        left: 3,
        hasRequirements: true,
        complete: false,
      },
    ];
    const { trpc, queryClient, wrap } = createTestTRPC({ 'documentServices.requirements.forDossier': () => data });
    queryClient.setQueryData(trpc.documentServices.requirements.forDossier.queryKey({ dossierId: 'dos_1' }), data as never);
    render(withIntl(wrap(<ServiceProgressView dossierId="dos_1" viewer="client" />)));
    expect(screen.getByText(/12 jours restants/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /3 éléments à remettre/ })).toHaveAttribute('href', '/fr/mon-espace/services/demandes/stz_1');
    vi.useRealTimers();
  });
});
