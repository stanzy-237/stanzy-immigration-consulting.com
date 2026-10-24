// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { CRS_DRAFT_KEY } from '@/features/crs/hooks/use-crs-draft';
import { DEFAULT_FORM as CRS_DEFAULT, toProfile as toCrsProfile } from '@/features/crs/lib/crs-form';
import { FswCalculator } from '@/features/fsw/components/fsw-calculator';

/**
 * Seam: the Calculateur 67 points as a visitor uses it. Nothing is stubbed
 * but navigation. Expected totals are worked by hand from IRCC's grid (see
 * the engine tests): language 6/5/4 per ability at CLB 9+/8/7, bachelor's
 * 21, 2–3 years 11, age 30 12.
 */
vi.mock('@/i18n/navigation', () => navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }));
const fetchSaved = vi.fn();
let saved: { id: string; name: string; total: number; rules: string; updatedAt: Date }[] = [];
vi.mock('@/trpc/react', () => ({
  api: {
    useUtils: () => ({ crs: { get: { fetch: fetchSaved } } }),
    crs: { list: { useQuery: (_input: unknown, opts?: { enabled?: boolean }) => ({ data: opts?.enabled === false ? undefined : saved }) } },
  },
}));

const useSession = vi.mocked(authClient.useSession);
const signedIn = () =>
  useSession.mockReturnValue({
    data: { user: { name: 'Aminata', email: 'aminata@example.com' }, session: {} },
    isPending: false,
  } as never);

/** The CRS answers both reuse paths below carry: 29, NCLC 8, 2 yrs Canada, "3+" abroad. */
const CRS_ANSWERS = {
  ...CRS_DEFAULT,
  age: '29',
  canadianWorkYears: 2,
  foreignWorkYears: 3,
  firstLanguage: { test: 'NCLC' as const, scores: { speaking: '8', listening: '8', reading: '8', writing: '8' } },
};

/** Ten days before the 2026-11-03 rules. */
const TODAY = new Date('2026-10-24T12:00:00-04:00');

const result = () => screen.getByRole('complementary', { name: 'Votre résultat' });
const total = () => within(result()).getByRole('status');
const stepPoints = (heading: string) =>
  within(screen.getByRole('region', { name: heading })).getByTestId('section-points');

function renderCalculator(locale: 'fr' | 'en' = 'fr') {
  return render(withIntl(<FswCalculator today={TODAY} />, locale));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  saved = [];
  useSession.mockReturnValue({ data: null, isPending: false } as never);
});

describe('FswCalculator', () => {
  it('starts at 68: NCLC 9 (24) + bachelor’s (21) + 2–3 years (11) + age 30 (12), éligible', () => {
    renderCalculator();

    expect(total()).toHaveTextContent('68');
    expect(within(result()).getByText('Éligible')).toBeInTheDocument();
    expect(stepPoints('Compétences linguistiques')).toHaveTextContent('24 / 28');
    expect(stepPoints('Niveau d’études')).toHaveTextContent('21 / 25');
  });

  it('shows the points missing below 67', () => {
    renderCalculator();

    fireEvent.change(screen.getByLabelText('Votre âge'), { target: { value: '37' } });

    // Age 37 = 10 → 66.
    expect(total()).toHaveTextContent('66');
    expect(within(result()).getByText('Non éligible')).toBeInTheDocument();
    expect(within(result()).getByText('Il vous manque 1 point pour atteindre le seuil.')).toBeInTheDocument();
  });

  it('names the requirement a candidate misses even with enough points', () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText('Votre plus haut diplôme'), { target: { value: 'doctorate' } });
    fireEvent.change(screen.getByLabelText('Expression écrite'), { target: { value: '6' } });

    // 18 + 25 + 11 + 12 = 66 … but the point is the requirement: below NCLC 7 in writing.
    expect(within(result()).getByText('Non éligible')).toBeInTheDocument();
    expect(within(result()).getByText(/NCLC\/CLB 7 dans les 4 compétences/)).toBeInTheDocument();
  });

  it('gives arranged employment only in an LMIA situation under the current rules', () => {
    renderCalculator();

    fireEvent.change(screen.getByLabelText('Avez-vous une offre d’emploi ?'), { target: { value: 'valid' } });
    expect(total()).toHaveTextContent('68');

    fireEvent.change(screen.getByLabelText('Situation de l’offre'), { target: { value: 'lmiaOffer' } });
    // + arranged employment 10 + adaptability 5 = 83.
    expect(total()).toHaveTextContent('83');
  });

  it('asks about the spouse only when a married or common-law spouse comes along', () => {
    renderCalculator();
    expect(screen.queryByLabelText(/Mon époux\(se\) ou conjoint\(e\) a NCLC\/CLB 4/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Votre état matrimonial'), { target: { value: 'married' } });
    fireEvent.change(
      screen.getByLabelText('Votre époux(se) ou conjoint(e) vous accompagnera-t-il/elle au Canada ?'),
      { target: { value: 'yes' } },
    );
    fireEvent.click(screen.getByLabelText(/Mon époux\(se\) ou conjoint\(e\) a NCLC\/CLB 4/));

    // + spouse language 5 → 73.
    expect(total()).toHaveTextContent('73');
  });

  it('converts raw test scores into levels from the converter dialog', async () => {
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: /Je ne connais pas mon NCLC\/CLB/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Entrez vos résultats de test' });
    fireEvent.change(within(dialog).getByLabelText('Test de la 1re langue officielle'), { target: { value: 'TCF' } });
    const scores = { 'Expression orale': '10', 'Compréhension orale': '458', 'Compréhension écrite': '453', 'Expression écrite': '10' };
    for (const [ability, score] of Object.entries(scores)) {
      fireEvent.change(within(dialog).getByLabelText(`1re langue — ${ability}`), { target: { value: score } });
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Appliquer les niveaux' }));

    // TCF 10/458/453/10 = NCLC 7 ×4 = 16 → 16 + 21 + 11 + 12 = 60.
    await waitFor(() => expect(total()).toHaveTextContent('60'));
    expect(stepPoints('Compétences linguistiques')).toHaveTextContent('16 / 28');
  });

  it('picks one of my saved CRS simulations from a dropdown to fill the form', async () => {
    signedIn();
    saved = [
      { id: 'sim_1', name: 'Avant TEF', total: 402, rules: '2025-03-25', updatedAt: new Date('2026-10-18T12:00:00Z') },
      { id: 'sim_2', name: 'Après TEF', total: 471, rules: '2025-03-25', updatedAt: new Date('2026-10-20T12:00:00Z') },
    ];
    fetchSaved.mockResolvedValue({ profile: toCrsProfile(CRS_ANSWERS) });
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre une simulation CRS' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Après TEF/ }));

    // CRS work answers are ranges (2 yrs in Canada, "3+" abroad) that may overlap, so the safe
    // reading is the longer one: 3 yrs = 11. NCLC 8 ×4 = 20, bachelor's 21, age 29 = 12,
    // adaptability Canadian work 10 → 74.
    await waitFor(() => expect(total()).toHaveTextContent('74'));
    expect(fetchSaved).toHaveBeenCalledWith({ id: 'sim_2' });
    expect(screen.getByLabelText('Votre âge')).toHaveValue(29);
    expect(screen.getByText(/Vérifiez votre expérience de travail/)).toBeInTheDocument();
  });

  it('shows each saved simulation with its score and date in the dropdown', async () => {
    signedIn();
    saved = [
      { id: 'sim_2', name: 'Après TEF', total: 471, rules: '2025-03-25', updatedAt: new Date('2026-10-20T12:00:00Z') },
    ];
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre une simulation CRS' }));
    const item = await screen.findByRole('menuitem', { name: /Après TEF/ });
    expect(item).toHaveTextContent('471 pts');
    expect(item).toHaveTextContent('20/10/2026');
  });

  it('also offers the CRS answers in progress on this device', async () => {
    window.localStorage.setItem(CRS_DRAFT_KEY, JSON.stringify(CRS_ANSWERS));
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre une simulation CRS' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Réponses en cours/ }));

    await waitFor(() => expect(total()).toHaveTextContent('74'));
  });

  it('offers nothing to reuse without saved simulations or CRS answers', () => {
    renderCalculator();
    expect(screen.queryByRole('button', { name: 'Reprendre une simulation CRS' })).not.toBeInTheDocument();
  });

  it('shows the arranged-employment adaptability points as a ticked item', () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText('Avez-vous une offre d’emploi ?'), { target: { value: 'valid' } });
    fireEvent.change(screen.getByLabelText('Situation de l’offre'), { target: { value: 'lmiaOffer' } });

    const item = screen.getByLabelText(/Offre d’emploi réservée \(comptée automatiquement\)/);
    expect(item).toBeChecked();
    expect(item).toBeDisabled();
  });

  it('states the date of the official criteria it follows', () => {
    renderCalculator();
    expect(screen.getByText('Critères officiels en vigueur au 16 octobre 2026.')).toBeInTheDocument();
  });

  it('keeps the answers on this device across visits', () => {
    const { unmount } = renderCalculator();
    fireEvent.change(screen.getByLabelText('Votre âge'), { target: { value: '37' } });
    unmount();

    renderCalculator();
    expect(screen.getByLabelText('Votre âge')).toHaveValue(37);
  });

  it.each(['fr', 'en'] as const)('has no axe violations (%s)', async (locale) => {
    const { container } = renderCalculator(locale);
    expect(await axe(container)).toHaveNoViolations();
  });
});
