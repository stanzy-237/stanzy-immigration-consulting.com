// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { ReportsView } from '@/features/reports/views/reports-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Signalements list (#160), the query in the cache as the route prefetches it. */
const api = vi.hoisted(() => ({ setStatus: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  api.setStatus.mockImplementation((input) => input);
});

const UUID = '3f1c2a9e-7b4d-4e2a-9c1f-0a6b5d8e7f21';
const reports = [
  {
    id: 'rep_1',
    message: 'Le bouton Signer ne répond pas.',
    path: '/fr/mon-espace/dossiers/d_1',
    userAgent: 'Mozilla/5.0 (iPhone)',
    rollbarIds: [UUID],
    status: 'NEW',
    createdAt: new Date('2026-11-20T09:00:00Z'),
    account: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', role: 'MEMBER' },
  },
  {
    id: 'rep_2',
    message: 'La facture ne s’ouvre pas.',
    path: '/fr/mon-espace',
    userAgent: null,
    rollbarIds: [],
    status: 'RESOLVED',
    createdAt: new Date('2026-11-19T09:00:00Z'),
    account: { id: 'acc_2', name: 'Paul Mbarga', email: 'paul@example.com', role: 'MEMBER' },
  },
];

function view() {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'reports.list': () => reports,
    'reports.setStatus': (input) => api.setStatus(input),
  });
  queryClient.setQueryData(trpc.reports.list.queryKey({}), reports as never);
  return render(withIntl(wrap(<ReportsView />)));
}

describe('the Signalements list (#160)', () => {
  it('shows each report with who sent it, the page and its Rollbar errors', async () => {
    const { container } = view();
    const first = screen.getByText('Aminata Diallo').closest('li')!;
    expect(within(first).getByText('Le bouton Signer ne répond pas.')).toBeInTheDocument();
    expect(within(first).getByText(/\/fr\/mon-espace\/dossiers\/d_1/)).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /Erreur 1/ })).toHaveAttribute(
      'href',
      `https://rollbar.com/occurrence/uuid/?uuid=${UUID}`,
    );
    const second = screen.getByText('Paul Mbarga').closest('li')!;
    expect(within(second).getByText('Aucune erreur Rollbar liée.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('narrows the list by status', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Résolu' }));
    expect(screen.queryByText('Aminata Diallo')).not.toBeInTheDocument();
    expect(screen.getByText('Paul Mbarga')).toBeInTheDocument();
  });

  it('flags a report and says so', async () => {
    view();
    const first = screen.getByText('Aminata Diallo').closest('li')!;
    fireEvent.change(within(first).getByLabelText('Statut'), { target: { value: 'IN_PROGRESS' } });
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith({ id: 'rep_1', status: 'IN_PROGRESS' }));
    expect(await screen.findByText('Statut mis à jour.')).toBeInTheDocument();
  });
});
