// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { MySpaceView } from '@/features/dossiers/views/my-space-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: « Mon espace » as a Client reads it, with their Dossiers in the cache
 * as the route prefetches them. The site's nav and footer are left out.
 */
vi.mock('@/i18n/navigation', () => navigationMock);
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));

const dossier = (extra: Record<string, unknown>) => ({
  id: 'dos_1',
  service: 'ACCOMPAGNEMENT' as const,
  stage: 'bassin',
  startStage: 'profil-ee',
  state: 'OPEN' as const,
  closedAt: null,
  closedReason: null,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  updatedAt: new Date('2026-10-30T10:00:00Z'),
  ...extra,
});

function mySpace(dossiers: ReturnType<typeof dossier>[]) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'dossiers.mine': () => dossiers });
  queryClient.setQueryData(trpc.dossiers.mine.queryKey(), dossiers as never);
  return render(withIntl(wrap(<MySpaceView />)));
}

describe('MySpaceView', () => {
  it('shows each Dossier with its current stage', async () => {
    const { container } = mySpace([dossier({})]);
    expect(screen.getByRole('heading', { name: 'Accompagnement Entrée Express' })).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Étapes du dossier' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Déjà fait');
    expect(steps[3]).toHaveTextContent('Fait');
    expect(steps[4]).toHaveAttribute('aria-current', 'step');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('tells a Client why a Dossier was closed', () => {
    mySpace([dossier({ state: 'CLOSED', closedAt: new Date('2026-10-31T10:00:00Z'), closedReason: 'Refus IRCC' })]);
    expect(screen.getByText('Clôturé')).toBeInTheDocument();
    expect(screen.getByText(/Motif : Refus IRCC/)).toBeInTheDocument();
  });

  it('points to the services when there is no Dossier yet', () => {
    mySpace([]);
    expect(screen.getByText('Vous n’avez pas encore de dossier.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Découvrir nos services' })).toBeInTheDocument();
  });
});
