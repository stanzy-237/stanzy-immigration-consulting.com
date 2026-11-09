// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { EMPTY_ANSWERS, type HandOver } from '@/features/document-services/lib/requirements';
import { ServiceStepsView } from '@/features/document-services/views/service-steps-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the Documents tab of a Client's Dossier, wrapped by the service's
 * steps: what to hand over first, then the documents to receive.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds-sans-fonds')!;

const progress = (handOver: HandOver, complete = handOver !== 'OPEN', handOverFirst = true) => ({
  id: 'stz_1',
  status: 'ACCEPTED',
  service: { name: pof.name },
  document: 'Lettre de la banque',
  startedOn: null,
  turnaroundDays: 10,
  dueOn: null,
  left: complete ? 0 : 2,
  hasRequirements: true,
  handOverFirst,
  complete,
  handOver,
});

const requirements = (complete: boolean) => ({
  request: {
    id: 'stz_1',
    status: 'ACCEPTED',
    createdAt: new Date('2026-11-07T10:00:00Z'),
    document: { id: 'doc_bank', title: 'Lettre de la banque' },
    service: { slug: pof.slug, name: pof.name },
  },
  dossier: { id: 'dos_1', client: 'Aminata Diallo', stage: 'commande', service: 'SERVICE_DOCUMENTAIRE' },
  editable: true,
  handOver: 'OPEN' as const,
  startedOn: null,
  dueOn: null,
  items: [],
  questionnaire: null,
  answers: EMPTY_ANSWERS,
  questionsLeft: complete ? [] : ['niu'],
  complete,
});

function tab(requests: ReturnType<typeof progress>[], { complete = false, submit = vi.fn() } = {}) {
  let current = requests;
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.requirements.forDossier': () => current,
    'documentServices.requirements.get': () => requirements(complete),
    'documentServices.requirements.submit': (input) => {
      submit(input);
      current = current.map((request) => ({ ...request, handOver: 'SUBMITTED' as const }));
    },
  });
  queryClient.setQueryData(trpc.documentServices.requirements.forDossier.queryKey({ dossierId: 'dos_1' }), requests as never);
  queryClient.setQueryData(trpc.documentServices.requirements.get.queryKey({ requestId: 'stz_1' }), requirements(complete) as never);
  return render(
    withIntl(
      wrap(
        <ServiceStepsView dossierId="dos_1">
          <p>Mes documents à recevoir</p>
        </ServiceStepsView>,
      ),
    ),
  );
}

describe('a service’s steps in the Documents tab', () => {
  it('asks for the pieces first and keeps the documents to receive for later', () => {
    tab([progress('OPEN')]);
    expect(screen.getByRole('heading', { name: 'Pièces à remettre' })).toBeInTheDocument();
    expect(screen.queryByText('Mes documents à recevoir')).toBeNull();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('shows the documents to receive once the Client clicks « Suivant »', async () => {
    const submit = vi.fn();
    tab([progress('OPEN', true)], { complete: true, submit });
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ requestId: 'stz_1' }));
    expect(await screen.findByText('Mes documents à recevoir')).toBeInTheDocument();
  });

  it('shows the documents to receive once the pieces were sent or confirmed', () => {
    tab([progress('CONFIRMED')]);
    expect(screen.getByText('Mes documents à recevoir')).toBeInTheDocument();
    expect(screen.getByText(/Pièces confirmées par Stanzy/)).toBeInTheDocument();
    // The steps stay in view: ① done, ② where the Client is now.
    expect(screen.getByRole('list', { name: 'Étapes du service' })).toHaveTextContent('Documents à recevoir');
    expect(screen.getByText('Documents à recevoir').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('leaves an Accompagnement’s Documents tab as it is', () => {
    tab([progress('OPEN', false, false)]);
    expect(screen.getByText('Mes documents à recevoir')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pièces à remettre' })).toBeNull();
  });

  it('changes nothing for a Dossier with no service to hand over for', () => {
    tab([]);
    expect(screen.getByText('Mes documents à recevoir')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pièces à remettre' })).toBeNull();
  });
});
