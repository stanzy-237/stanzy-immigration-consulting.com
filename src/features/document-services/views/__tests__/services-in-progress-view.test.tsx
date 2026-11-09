// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import type { HandOver } from '@/features/document-services/lib/requirements';
import { ServicesInProgressView } from '@/features/document-services/views/services-in-progress-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: « Services » under Clients, with the services under way in the cache as the route prefetches them. */
const service = (slug: string) => {
  const found = STARTER_SERVICES.find((candidate) => candidate.slug === slug)!;
  return { slug: found.slug, name: found.name };
};
const underWay = (id: string, slug: string, client: string, handOver: HandOver = 'OPEN', status = 'ACCEPTED') => ({
  id,
  dossierId: `dos_${id}`,
  client,
  status,
  service: service(slug),
  document: 'Lettre de la banque',
  startedOn: null,
  turnaroundDays: 10,
  dueOn: null,
  left: handOver === 'OPEN' ? 2 : 0,
  hasRequirements: true,
  complete: handOver !== 'OPEN',
  handOver,
});

function page() {
  const data = [
    underWay('stz_1', 'preuve-de-fonds', 'Aminata Diallo'),
    underWay('stz_2', 'preuve-de-fonds-sans-fonds', 'Paul Mbarga', 'SUBMITTED'),
    underWay('stz_3', 'attestation-cnps', 'Marie Ngo', 'OPEN', 'REQUESTED'),
  ];
  // The catalogue, in its order; only the active services make tabs.
  const catalogue = STARTER_SERVICES.map((entry, index) => ({ id: `svc_${index}`, slug: entry.slug, name: entry.name, active: true }));
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.dashboard.underWay': () => data,
    'documentServices.dashboard.list': () => catalogue,
  });
  queryClient.setQueryData(trpc.documentServices.dashboard.underWay.queryKey(), data as never);
  queryClient.setQueryData(trpc.documentServices.dashboard.list.queryKey(), catalogue as never);
  return render(withIntl(wrap(<ServicesInProgressView />)));
}

describe('« Services » under Clients', () => {
  it('has a tab per catalogue service, in its order and by short name, both proof of funds together, each with its count', () => {
    page();
    const tabs = screen.getByRole('tablist', { name: 'Services' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Tous, 3 services',
      'Preuve de fonds, 2 services',
      'Certificat de police, 0 service',
      'Attestation CNPS, 1 service',
      'Compte salaire, 0 service',
      'ACF, 0 service',
      'Pack expérience pro, 0 service',
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('leads a request not yet accepted to where Stanzy accepts it', () => {
    page();
    expect(screen.getByRole('link', { name: 'Ouvrir le service de Marie Ngo' })).toHaveAttribute('href', '/dossiers/dos_stz_3#stanzy');
  });

  it('shows only the tab’s services, and leads to each', () => {
    page();
    fireEvent.click(screen.getByRole('tab', { name: /Preuve de fonds/ }));
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByText(/Aminata|Paul|Marie/).textContent)).toEqual(['Aminata Diallo', 'Paul Mbarga']);
    expect(rows[1]).toHaveTextContent('Pièces envoyées');
    expect(within(rows[0]!).getByRole('link', { name: 'Ouvrir le service de Aminata Diallo' })).toHaveAttribute(
      'href',
      '/dossiers/dos_stz_1/services/stz_1',
    );
  });
});
