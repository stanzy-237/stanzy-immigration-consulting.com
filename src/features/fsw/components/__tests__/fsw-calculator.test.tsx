// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { CRS_DRAFT_KEY } from '@/features/crs/hooks/use-crs-draft';
import { DEFAULT_FORM as CRS_DEFAULT } from '@/features/crs/lib/crs-form';
import { FswCalculator } from '@/features/fsw/components/fsw-calculator';

/**
 * Seam: the Calculateur 67 points as a visitor uses it. Nothing is stubbed
 * but navigation. Expected totals are worked by hand from IRCC's grid (see
 * the engine tests): language 6/5/4 per ability at CLB 9+/8/7, bachelor's
 * 21, 2–3 years 11, age 30 12.
 */
vi.mock('@/i18n/navigation', () => navigationMock);

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

  it('reuses the answers of the Calculateur CRS on this device', () => {
    window.localStorage.setItem(
      CRS_DRAFT_KEY,
      JSON.stringify({
        ...CRS_DEFAULT,
        age: '29',
        canadianWorkYears: 2,
        foreignWorkYears: 3,
        firstLanguage: { test: 'NCLC', scores: { speaking: '8', listening: '8', reading: '8', writing: '8' } },
      }),
    );
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre mes réponses du Calculateur CRS' }));

    // NCLC 8 ×4 = 20, bachelor's 21, 2 + 3 = 5 yrs = 13, age 29 = 12, adaptability Canadian work 10 → 76.
    expect(screen.getByLabelText('Votre âge')).toHaveValue(29);
    expect(total()).toHaveTextContent('76');
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
