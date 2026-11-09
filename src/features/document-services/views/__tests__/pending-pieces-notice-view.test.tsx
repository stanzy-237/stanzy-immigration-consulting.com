// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import type { HandOver } from '@/features/document-services/lib/requirements';
import { PendingPiecesNoticeView } from '@/features/document-services/views/pending-pieces-notice-view';
import { ServicesUnderWayView } from '@/features/document-services/views/services-under-way-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the notice of pieces still to hand over, with the Client's services under way in the cache. */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

const named = (slug: string) => STARTER_SERVICES.find((service) => service.slug === slug)!.name;
const underWay = (id: string, slug: string, handOver: HandOver, hasRequirements = true) => ({
  id,
  dossierId: 'dos_1',
  status: 'ACCEPTED',
  service: { name: named(slug) },
  document: 'Document',
  startedOn: null,
  turnaroundDays: null,
  dueOn: null,
  left: handOver === 'OPEN' ? 2 : 0,
  hasRequirements,
  complete: handOver !== 'OPEN',
  handOver,
});

function notice(services: ReturnType<typeof underWay>[]) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'documentServices.requirements.mine': () => services });
  queryClient.setQueryData(trpc.documentServices.requirements.mine.queryKey(), services as never);
  return render(withIntl(wrap(<PendingPiecesNoticeView />)));
}

describe('the notice of pieces still to hand over', () => {
  it('names each service waiting for its pieces and leads to « Mes services en cours »', () => {
    notice([
      underWay('stz_1', 'preuve-de-fonds-sans-fonds', 'OPEN'),
      underWay('stz_2', 'attestation-cnps', 'OPEN'),
      underWay('stz_3', 'certificat-de-police', 'SUBMITTED'),
      underWay('stz_4', 'compte-salaire', 'OPEN', false),
    ]);
    expect(
      screen.getByText(
        'Vous n’avez pas encore envoyé les pièces nécessaires pour Preuve de fonds (vous n’avez pas les fonds) et Attestation CNPS.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir mes services' })).toHaveAttribute('href', '/fr/mon-espace/services#en-cours');
  });

  it('says nothing once every piece is sent', () => {
    const { container } = notice([underWay('stz_3', 'certificat-de-police', 'SUBMITTED')]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('« Mes services en cours »', () => {
  it('lists every service under way, where it stands, and leads to each', () => {
    const services = [underWay('stz_1', 'preuve-de-fonds-sans-fonds', 'OPEN'), underWay('stz_3', 'certificat-de-police', 'SUBMITTED')];
    const { trpc, queryClient, wrap } = createTestTRPC({ 'documentServices.requirements.mine': () => services });
    queryClient.setQueryData(trpc.documentServices.requirements.mine.queryKey(), services as never);
    render(withIntl(wrap(<ServicesUnderWayView />)));
    const section = screen.getByRole('region', { name: 'Mes services en cours' });
    expect(section).toHaveAttribute('id', 'en-cours');
    expect(section).toHaveTextContent('2 pièces à remettre');
    expect(section).toHaveTextContent('Pièces envoyées');
    expect(screen.getByRole('link', { name: 'Voir le service Preuve de fonds (vous n’avez pas les fonds)' })).toHaveAttribute(
      'href',
      '/fr/mon-espace/services/demandes/stz_1',
    );
  });
});
