// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { MyServiceView } from '@/features/document-services/views/my-service-view';
import { MyServicesView } from '@/features/document-services/views/my-services-view';
import { ServiceEditView } from '@/features/document-services/views/service-edit-view';
import { ServicesDashboardView } from '@/features/document-services/views/services-dashboard-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Services documentaires screens with their data in the cache, as the routes prefetch it. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => vi.clearAllMocks());

const starter = STARTER_SERVICES.find((service) => service.slug === 'certificat-de-police')!;
const police = { ...starter, id: 'svc_1', price: 30_000 };

describe('the Services documentaires, for a Client', () => {
  function list(data: unknown, documentId: string | null = null) {
    const { trpc, queryClient, wrap } = createTestTRPC({ 'documentServices.list': () => data });
    queryClient.setQueryData(trpc.documentServices.list.queryKey(), data as never);
    return render(withIntl(wrap(<MyServicesView documentId={documentId} />)));
  }

  it('lists the services with their prices, carrying the Document along', async () => {
    const { container } = list({ available: true, services: [police] }, 'doc_1');
    const card = screen.getByRole('link', { name: /Certificat de police/ });
    expect(card).toHaveAttribute('href', '/fr/mon-espace/services/certificat-de-police?document=doc_1');
    expect(within(card).getByText(/30\s000\sFCFA/)).toBeInTheDocument();
    expect(within(card).getByText('par pays et par personne')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says it is for Cameroon only, elsewhere', () => {
    list({ available: false, services: [] });
    expect(screen.getByText(/réservés aux clients qui résident au Cameroun/)).toBeInTheDocument();
  });

  function page(document: unknown, ask = vi.fn()) {
    const data = { available: true, service: police, document };
    const { trpc, queryClient, wrap } = createTestTRPC({
      'documentServices.get': () => data,
      'accompagnement.stanzy.request': (input) => ask(input) ?? { id: 'stz_1' },
    });
    queryClient.setQueryData(trpc.documentServices.get.queryKey({ slug: 'certificat-de-police', documentId: 'doc_1' }), data as never);
    return render(withIntl(wrap(<MyServiceView slug="certificat-de-police" documentId="doc_1" />)));
  }

  it('shows the conditions and the contract, and asks Stanzy once they are accepted', async () => {
    const ask = vi.fn();
    const { container } = page({ id: 'doc_1', title: 'Certificat de police', kind: 'policeCertificate', dossierId: 'dos_1' }, ask);
    expect(screen.getByRole('heading', { name: 'Conditions' })).toBeInTheDocument();
    expect(screen.getByText(/obtenir le document suivant : \[le service\]/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    const send = screen.getByRole('button', { name: 'Stanzy s’en charge' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/J’ai lu les conditions et le contrat/));
    fireEvent.click(send);
    await waitFor(() => expect(ask).toHaveBeenCalledWith({ documentId: 'doc_1', serviceId: 'svc_1', accepted: true }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/mon-espace/dossiers/dos_1?document=doc_1#documents'));
  });

  it('offers nothing to ask once the Document can’t be asked any more', () => {
    page(null);
    expect(screen.queryByRole('button', { name: 'Stanzy s’en charge' })).not.toBeInTheDocument();
    expect(screen.getByText(/n’est plus à demander/)).toBeInTheDocument();
  });
});

describe('the Services documentaires, in the Tableau de bord', () => {
  it('adds the starting services in one click', async () => {
    const addStarters = vi.fn();
    const { trpc, queryClient, wrap } = createTestTRPC({
      'documentServices.dashboard.list': () => [],
      'documentServices.dashboard.addStarters': () => addStarters() ?? { added: STARTER_SERVICES.length },
    });
    queryClient.setQueryData(trpc.documentServices.dashboard.list.queryKey(), [] as never);
    render(withIntl(wrap(<ServicesDashboardView />)));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter les services de départ' }));
    await waitFor(() => expect(addStarters).toHaveBeenCalled());
    expect(await screen.findByText(`${STARTER_SERVICES.length} services ajoutés`)).toBeInTheDocument();
  });

  it('saves a service with its price as a percentage', async () => {
    const save = vi.fn();
    const pof = { ...STARTER_SERVICES[0]!, id: 'svc_2', active: false, price: 0 };
    const { trpc, queryClient, wrap } = createTestTRPC({
      'documentServices.dashboard.get': () => pof,
      'documentServices.dashboard.save': (input) => save(input) ?? { id: 'svc_2' },
    });
    queryClient.setQueryData(trpc.documentServices.dashboard.get.queryKey({ id: 'svc_2' }), pof as never);
    render(withIntl(wrap(<ServiceEditView id="svc_2" />)));
    fireEvent.change(screen.getByLabelText(/Pourcentage du montant à justifier/), { target: { value: '2,5' } });
    fireEvent.click(screen.getByLabelText('Proposé aux clients'));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        id: 'svc_2',
        service: expect.objectContaining({ slug: 'preuve-de-fonds', priceKind: 'PERCENT', price: 250, active: true }),
      }),
    );
  });
});
