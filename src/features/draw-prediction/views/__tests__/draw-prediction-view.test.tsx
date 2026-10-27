// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DrawPredictionView } from '@/features/draw-prediction/views/draw-prediction-view';
import type { DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/server/draws-router';

/** Seam: the Prochain tirage page as a visitor sees it, fed fixture Tirages. */
const NOW = new Date('2026-10-27T10:00:00Z');

const HEALTH = 'Healthcare and social services occupations 2026-Version 1';
const LABELS: Partial<Record<DrawGroup, string>> = {
  GENERAL: 'No Program Specified',
  PNP: 'Provincial Nominee Program',
  CEC: 'Canadian Experience Class',
};
const draw = (round: number, group: DrawGroup, date: string, crsMin: number, typeLabel = LABELS[group]!): DrawSummary => ({
  round: String(round),
  roundNumber: round,
  date,
  typeLabel,
  group,
  invitations: 1000,
  crsMin,
  irccUrl: null,
  crsChange: null,
  tieBreakAt: null,
});

/**
 * Worked by hand (12 months back from NOW: 2025-10-27):
 * - PNP 09-29, 10-21: one gap of 22 days → 10-21 + 20 = 11-10 to 10-21 + 24 = 11-14.
 * - CEC 09-22, 10-06, 10-20: gaps 14, 14 → 10-20 + 12 = 11-01 to 10-20 + 16 = 11-05.
 *   Scores 515, 522, 509: range 509–522, median 515.
 * - CATEGORY 07-08, 08-05, 09-02: gaps 28, 28 → 09-28 to 10-02, already passed,
 *   so 10-27 to 10-31: the earliest, featured. Scores 455, 462, 433: 433–462,
 *   median 455. Last 3: Health, Health, Trades → Health, 2 of 3.
 * - GENERAL: last Tirage 2025-05-14, over 12 months ago → left out.
 */
const DRAWS: DrawSummary[] = [
  draw(460, 'PNP', '2026-10-21', 790),
  draw(459, 'CEC', '2026-10-20', 515),
  draw(458, 'CEC', '2026-10-06', 522),
  draw(457, 'PNP', '2026-09-29', 772),
  draw(456, 'CEC', '2026-09-22', 509),
  draw(455, 'CATEGORY', '2026-09-02', 455, HEALTH),
  draw(454, 'CATEGORY', '2026-08-05', 462, HEALTH),
  draw(453, 'CATEGORY', '2026-07-08', 433, 'Trades Occupations, 2026-Version 3'),
  draw(400, 'GENERAL', '2025-05-14', 480),
];

const query = {
  list: { data: DRAWS as DrawSummary[] | undefined, isError: false },
  latest: {
    data: { draws: DRAWS.slice(0, 1), lastSyncedAt: new Date(NOW.getTime() - 2 * 3600_000) } as
      | { draws: DrawSummary[]; lastSyncedAt: Date | null }
      | undefined,
    isError: false,
  },
};

vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));
vi.mock('@/trpc/react', () => ({
  api: {
    draws: {
      list: { useQuery: () => query.list },
      latest: { useQuery: () => query.latest },
    },
  },
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
  query.list.data = DRAWS;
  query.latest.data = { draws: DRAWS.slice(0, 1), lastSyncedAt: new Date(NOW.getTime() - 2 * 3600_000) };
});

afterEach(() => {
  vi.useRealTimers();
});

const featured = () => screen.getByRole('region', { name: 'Prochain tirage le plus probable' });
const table = () => within(screen.getByRole('region', { name: 'Par type de tirage' })).getByRole('table');
const bodyRows = () => within(table()).getAllByRole('row').slice(1);

describe('DrawPredictionView', () => {
  it('features the most likely next Tirage with its window, range, median and why', () => {
    render(withIntl(<DrawPredictionView />));

    const title = screen.getByRole('heading', { level: 1, name: 'Prochain tirage' });
    expect(title.nextElementSibling).toHaveTextContent('Prédiction du prochain tirage Entrée Express');
    expect(screen.getByText('Mis à jour il y a 2 heures')).toBeInTheDocument();

    const card = within(featured());
    expect(card.getByRole('heading', { name: 'Catégorie' })).toBeInTheDocument();
    expect(card.getByText('433–462')).toBeInTheDocument();
    expect(card.getByText('médiane 455')).toBeInTheDocument();
    expect(card.getByText('entre le 27 et le 31 oct.')).toBeInTheDocument();
    expect(
      card.getByText(
        'Le dernier tirage Catégorie date du 2 sept. ; ils ont lieu en général tous les 28 jours. ' +
          'La date attendue est passée : le prochain peut tomber d’un jour à l’autre. ' +
          '2 des 3 derniers étaient des tirages Santé et social.',
      ),
    ).toBeInTheDocument();
  });

  it('gives one row per group with a Tirage in the last 12 months, with the data behind it', () => {
    render(withIntl(<DrawPredictionView />));

    expect(bodyRows().map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual(['PCP', 'CEC', 'Catégorie']);
    const cec = within(bodyRows()[1]!);
    expect(cec.getByText('entre le 1 et le 5 nov.')).toBeInTheDocument();
    expect(cec.getByText('509–522')).toBeInTheDocument();
    expect(cec.getByText('médiane 515')).toBeInTheDocument();
    expect(cec.getByText('Le dernier tirage CEC date du 20 oct. ; ils ont lieu en général tous les 14 jours.')).toBeInTheDocument();
    expect(cec.getByText('3 tirages en 12 mois · 3 derniers scores : 515, 522, 509')).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getByText('entre le 10 et le 14 nov.')).toBeInTheDocument();
  });

  it('warns that it is an estimate, not a guarantee', () => {
    render(withIntl(<DrawPredictionView />));

    expect(screen.getByRole('note')).toHaveTextContent(/^Estimation, pas une garantie : IRCC n’annonce pas ses tirages\./);
  });

  it('says so before the first update has run', () => {
    query.list.data = [];
    query.latest.data = { draws: [], lastSyncedAt: null };
    render(withIntl(<DrawPredictionView />));

    expect(screen.getByText(/Pas encore de prédiction/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Prochain tirage le plus probable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('reads in English at /en', () => {
    render(withIntl(<DrawPredictionView />, 'en'));

    const card = within(screen.getByRole('region', { name: 'Most likely next draw' }));
    expect(card.getByText('between Oct 27 and Oct 31')).toBeInTheDocument();
    expect(card.getByText(/2 of the last 3 were Health & social draws\.$/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    vi.useRealTimers();
    const { container } = render(withIntl(<DrawPredictionView />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
