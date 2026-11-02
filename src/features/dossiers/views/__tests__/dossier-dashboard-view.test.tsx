// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierDashboardView } from '@/features/dossiers/views/dossier-dashboard-view';
import { DossierNewView } from '@/features/dossiers/views/dossier-new-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: a Dossier and « Ouvrir un dossier » in the Tableau de bord, as the
 * consultant uses them. The Dossier is in the cache as the route prefetches
 * it; stubs answer and record what the page sends.
 */
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const at = (stage: string, extra: Record<string, unknown> = {}) => ({
  id: 'dos_1',
  service: 'EDE' as const,
  stage,
  startStage: 'compte',
  state: 'OPEN' as const,
  closedAt: null,
  closedReason: null,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  updatedAt: new Date('2026-10-30T10:00:00Z'),
  account: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com' },
  events: [
    {
      id: 'ev_1',
      kind: 'OPENED' as const,
      fromStage: null,
      toStage: 'compte',
      note: null,
      createdAt: new Date('2026-10-20T10:00:00Z'),
      actor: { name: 'Stanzy' },
    },
  ],
  ...extra,
});

const api = vi.hoisted(() => ({ dossier: undefined as unknown, advance: vi.fn(), close: vi.fn(), open: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  api.advance.mockImplementation(() => {
    api.dossier = at('etablissement');
    return { stage: 'etablissement' };
  });
});

function dossierPage(dossier = at('compte')) {
  api.dossier = dossier;
  const { trpc, queryClient, wrap } = createTestTRPC({
    'dossiers.dashboard.get': () => api.dossier,
    'dossiers.dashboard.list': () => [],
    'dossiers.dashboard.advance': (input) => api.advance(input),
    'dossiers.dashboard.moveBack': () => ({ stage: 'verification' }),
    'dossiers.dashboard.close': (input) => api.close(input),
  });
  queryClient.setQueryData(trpc.dossiers.dashboard.get.queryKey({ id: 'dos_1' }), dossier as never);
  return render(withIntl(wrap(<DossierDashboardView id="dos_1" />)));
}

describe('DossierDashboardView', () => {
  it('shows the stages, the ones before the start « Déjà fait »', async () => {
    const { container } = dossierPage();
    const steps = within(screen.getByRole('list', { name: 'Étapes du dossier' })).getAllByRole('listitem');
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent('Vérification des documentsDéjà fait');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('advances from the stage it shows, then shows the new one', async () => {
    dossierPage();
    fireEvent.click(screen.getByRole('button', { name: 'Étape suivante' }));

    await waitFor(() => expect(api.advance).toHaveBeenCalledWith({ id: 'dos_1', from: 'compte' }));
    expect(await screen.findByText('Dossier passé à l’étape suivante')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Démarches auprès de l’établissement').closest('li')).toHaveAttribute('aria-current', 'step'),
    );
  });

  it('warns and refreshes when the Dossier changed in the meantime', async () => {
    api.advance.mockImplementation(() => {
      throw new Error('DOSSIER_STAGE_CHANGED');
    });
    dossierPage();
    fireEvent.click(screen.getByRole('button', { name: 'Étape suivante' }));
    expect(await screen.findByText('Ce dossier a changé entre-temps : la page est à jour.')).toBeInTheDocument();
  });

  it('says the work is done at the last stage', () => {
    dossierPage(at('rapport'));
    expect(screen.queryByRole('button', { name: 'Étape suivante' })).not.toBeInTheDocument();
    expect(screen.getByText('Dernière étape atteinte : le travail est terminé.')).toBeInTheDocument();
  });

  it('asks for a reason before closing', async () => {
    dossierPage();
    fireEvent.click(screen.getByRole('button', { name: 'Clôturer le dossier' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer' }));
    expect(await within(dialog).findByText('Indiquez un motif (3 caractères au moins).')).toBeInTheDocument();
    expect(api.close).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Le Client a abandonné.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer' }));
    await waitFor(() => expect(api.close).toHaveBeenCalledWith({ id: 'dos_1', reason: 'Le Client a abandonné.' }));
    expect(await screen.findByText('Dossier clôturé')).toBeInTheDocument();
  });

  it('shows a closed Dossier’s reason and no moves', () => {
    dossierPage(at('compte', { state: 'CLOSED', closedAt: new Date('2026-10-31T10:00:00Z'), closedReason: 'Refus IRCC' }));
    expect(screen.queryByRole('button', { name: 'Étape suivante' })).not.toBeInTheDocument();
    expect(screen.getByText(/Motif : Refus IRCC/)).toBeInTheDocument();
  });
});

describe('DossierNewView', () => {
  it('finds an Account, then opens its Dossier at the chosen stage', async () => {
    api.open.mockResolvedValue({ id: 'dos_9' });
    const { wrap } = createTestTRPC({
      'dossiers.dashboard.searchAccounts': ({ query }) =>
        query === 'amin' ? [{ id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', status: 'LEAD' }] : [],
      'dossiers.dashboard.open': (input) => api.open(input),
      'dossiers.dashboard.list': () => [],
    });
    render(withIntl(wrap(<DossierNewView />)));

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le dossier' }));
    expect(await screen.findByText('Choisissez un compte.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Compte'), { target: { value: 'amin' } });
    fireEvent.click(await screen.findByRole('button', { name: /Aminata Diallo/ }));
    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'VERIFICATION' } });
    fireEvent.change(screen.getByLabelText('Étape de départ'), { target: { value: 'revue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le dossier' }));

    await waitFor(() =>
      expect(api.open).toHaveBeenCalledWith({ accountId: 'acc_1', service: 'VERIFICATION', startStage: 'revue' }),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dossiers/dos_9'));
  });
});
