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
 * Worked by hand (12 months back from NOW, a Tuesday: 2025-10-27):
 * - PNP every other Monday, 08-17 to 10-26 → 10-26 + 14 = Monday 11-09. The 4
 *   Tirages from 09-14 on (two earlier ones each) replay exactly: reliable,
 *   so the day is named. Last 3: 770, 752, 760 → 760; changes over the last 6
 *   37 47 16 8 18 → median 18, × 1.5 = 27 → 733–787.
 * - CEC Tuesdays 09-22, 10-06, 10-20 → Tuesday 11-03; one replay only, so no
 *   reliability, but every Tirage on a Tuesday names the day. Scores 515, 522,
 *   509 → 515; changes 13, 7 → 10, × 1.5 = 15 → 500–530.
 * - CATEGORY Wed 07-08, Thu 08-06, Fri 09-04, Wed 09-30: gaps 29 29 26 → 29;
 *   09-30 + 29 = Thu 10-29 → the Wednesday within 3 days, 10-28: the earliest,
 *   featured. Wednesday is only 2 of 4, so the week only (10-26 to 11-01).
 *   Last 3: Health, Health, Trades → Health, 2 of 3; Health alone 448, 455,
 *   470 → 455; changes 15, 7 → 11, × 1.5 = 16.5 → 17 → 438–472.
 * - GENERAL: last Tirage 2025-05-14, over 12 months ago → left out.
 */
const DRAWS: DrawSummary[] = [
  draw(470, 'PNP', '2026-10-26', 770),
  draw(469, 'CEC', '2026-10-20', 515),
  draw(468, 'PNP', '2026-10-12', 752),
  draw(467, 'CEC', '2026-10-06', 522),
  draw(466, 'CATEGORY', '2026-09-30', 448, HEALTH),
  draw(465, 'PNP', '2026-09-28', 760),
  draw(464, 'CEC', '2026-09-22', 509),
  draw(463, 'PNP', '2026-09-14', 744),
  draw(462, 'CATEGORY', '2026-09-04', 455, HEALTH),
  draw(461, 'PNP', '2026-08-31', 697),
  draw(460, 'PNP', '2026-08-17', 734),
  draw(459, 'CATEGORY', '2026-08-06', 433, 'Trades Occupations, 2026-Version 3'),
  draw(458, 'CATEGORY', '2026-07-08', 470, HEALTH),
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
  it('features the most likely next Tirage with its week, range, reliability and why', () => {
    render(withIntl(<DrawPredictionView />));

    const title = screen.getByRole('heading', { level: 1, name: 'Prochain tirage' });
    expect(title.nextElementSibling).toHaveTextContent('Prédiction du prochain tirage Entrée Express');
    expect(screen.getByText('Mis à jour il y a 2 heures')).toBeInTheDocument();

    const card = within(featured());
    expect(card.getByRole('heading', { name: 'Catégorie' })).toBeInTheDocument();
    expect(card.getByText('438–472')).toBeInTheDocument();
    expect(card.getByText('autour de 455')).toBeInTheDocument();
    expect(card.getByText('Semaine probable')).toBeInTheDocument();
    expect(card.getByText('Fiabilité inconnue')).toBeInTheDocument();
    expect(card.getByText('semaine du 26 octobre, date incertaine')).toBeInTheDocument();
    expect(card.getByText('Pas encore assez de tirages Catégorie pour mesurer la fiabilité.')).toBeInTheDocument();
    expect(
      card.getByText(
        'Le dernier tirage Catégorie date du 30 sept. ; ils ont lieu en général tous les 29 jours, le plus souvent le mercredi. ' +
          '2 des 3 derniers étaient des tirages Santé et social.',
      ),
    ).toBeInTheDocument();
    expect(card.getByText('4 tirages en 12 mois · 3 derniers scores Santé et social : 448, 455, 470')).toBeInTheDocument();
  });

  it('gives one row per group with a Tirage in the last 12 months, naming the day where it can', () => {
    render(withIntl(<DrawPredictionView />));

    expect(bodyRows().map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual(['PCP', 'CEC', 'Catégorie']);
    const cec = within(bodyRows()[1]!);
    expect(cec.getByText('probablement le mardi 3 novembre')).toBeInTheDocument();
    expect(cec.getByText('500–530')).toBeInTheDocument();
    expect(cec.getByText('autour de 515')).toBeInTheDocument();
    expect(
      cec.getByText('Le dernier tirage CEC date du 20 oct. ; ils ont lieu en général tous les 14 jours, le plus souvent le mardi.'),
    ).toBeInTheDocument();
    expect(cec.getByText('3 tirages en 12 mois · 3 derniers scores : 515, 522, 509')).toBeInTheDocument();

    const pnp = within(bodyRows()[0]!);
    expect(pnp.getByText('probablement le lundi 9 novembre')).toBeInTheDocument();
    expect(pnp.getByText('733–787')).toBeInTheDocument();
    expect(pnp.getByText('Fiabilité élevée')).toBeInTheDocument();
    expect(
      pnp.getByText(
        'Sur les 12 derniers mois, nos prédictions PCP ont visé la bonne semaine 100 % du temps, ' +
          'le bon jour 100 % et la bonne fourchette de score 100 %.',
      ),
    ).toBeInTheDocument();
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
    expect(card.getByText('week of October 26, date uncertain')).toBeInTheDocument();
    expect(card.getByText(/2 of the last 3 were Health & social draws\.$/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    vi.useRealTimers();
    const { container } = render(withIntl(<DrawPredictionView />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
