// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, router, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { CrsCalculator } from '@/features/crs/components/crs-calculator';

/**
 * Seam: the calculator as a visitor uses it — answering questions and reading
 * the score. Only the browser auth client and the tRPC hooks are stubbed.
 * Expected totals are worked by hand from IRCC's tables (see the engine tests).
 */
vi.mock('@/i18n/navigation', () => navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { useSession: vi.fn() },
}));
const save = vi.fn();
vi.mock('@/trpc/react', () => ({
  api: {
    useUtils: () => ({ crs: { list: { invalidate: vi.fn() } } }),
    crs: {
      save: { useMutation: () => ({ mutate: save, isPending: false, isSuccess: false }) },
      list: { useQuery: () => ({ data: [] }) },
      get: { useQuery: () => ({ data: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
      rename: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

const useSession = vi.mocked(authClient.useSession);
const signedOut = () => useSession.mockReturnValue({ data: null, isPending: false } as never);
const signedIn = () =>
  useSession.mockReturnValue({
    data: { user: { name: 'Aminata', email: 'aminata@example.com' }, session: {} },
    isPending: false,
  } as never);

/** Ten days before the 2026-11-03 rules, so the current rules apply by default. */
const TODAY = new Date('2026-10-24T12:00:00-04:00');

const total = () => within(screen.getByRole('complementary', { name: 'Votre score' })).getByRole('status');
const sectionPoints = (heading: string) =>
  within(screen.getByRole('region', { name: heading })).getByTestId('section-points');

function renderCalculator(locale: 'fr' | 'en' = 'fr') {
  return render(withIntl(<CrsCalculator today={TODAY} />, locale));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  signedOut();
});

describe('CrsCalculator', () => {
  it('starts as a single 30-year-old with a bachelor’s degree: 105 + 120 = 225', () => {
    renderCalculator();

    expect(total()).toHaveTextContent('225');
    expect(sectionPoints('Âge')).toHaveTextContent('105');
    expect(sectionPoints('Niveau d’études')).toHaveTextContent('120');
  });

  it('updates the score as answers change', () => {
    renderCalculator();

    fireEvent.change(screen.getByLabelText('Votre âge'), { target: { value: '29' } });
    // 110 + 120 = 230.
    expect(total()).toHaveTextContent('230');

    fireEvent.change(screen.getByLabelText('Test de la 1re langue officielle'), {
      target: { value: 'CLB' },
    });
    for (const skill of ['Speaking', 'Listening', 'Reading', 'Writing']) {
      fireEvent.change(screen.getByLabelText(`1re langue — ${skill}`), { target: { value: '9' } });
    }
    // + CLB 9 ×4 = 124, + transferability bachelor's & CLB 9 = 25 → 379.
    expect(total()).toHaveTextContent('379');
  });

  it('shows the NCLC level of each raw result and flags an impossible one', () => {
    renderCalculator();

    fireEvent.change(screen.getByLabelText('Test de la 1re langue officielle'), {
      target: { value: 'IELTS' },
    });
    fireEvent.change(screen.getByLabelText('1re langue — Listening'), {
      target: { value: '8.5' },
    });
    expect(screen.getByTestId('level-firstLanguage-listening')).toHaveTextContent('NCLC/CLB 10');

    fireEvent.change(screen.getByLabelText('1re langue — Speaking'), {
      target: { value: '9.5' },
    });
    expect(screen.getByLabelText('1re langue — Speaking')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Ce résultat n’existe pas pour ce test.')).toBeInTheDocument();
  });

  it('asks about the spouse only when a married or common-law spouse comes along', () => {
    renderCalculator();
    expect(screen.queryByRole('region', { name: 'Facteurs du conjoint' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Votre état matrimonial'), { target: { value: 'married' } });
    fireEvent.change(screen.getByLabelText('Votre époux(se) ou conjoint(e) vous accompagnera-t-il/elle au Canada ?'), {
      target: { value: 'yes' },
    });
    // With-spouse tables: 30 = 95, bachelor's = 112 → 207.
    expect(screen.getByRole('region', { name: 'Facteurs du conjoint' })).toBeInTheDocument();
    expect(total()).toHaveTextContent('207');

    fireEvent.click(screen.getByLabelText('Mon époux(se) ou conjoint(e) est citoyen(ne) canadien(ne) ou résident(e) permanent(e)'));
    expect(screen.queryByRole('region', { name: 'Facteurs du conjoint' })).not.toBeInTheDocument();
    expect(total()).toHaveTextContent('225');
  });

  it('previews the 2026-11-03 rules: high-wage experience joins the Canadian work points', () => {
    renderCalculator();
    expect(screen.queryByLabelText(/profession à salaire élevé/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('À partir du 3 novembre 2026'));
    fireEvent.change(screen.getByLabelText('Expérience de travail qualifiée au Canada'), {
      target: { value: '3' },
    });
    const highWage = screen.getByLabelText(
      '12 mois ou plus d’expérience canadienne dans une profession à salaire élevé',
    );
    expect(within(highWage).getByRole('option', { name: 'Au moins 2 fois la médiane' })).toBeInTheDocument();
    fireEvent.change(highWage, { target: { value: '2x' } });

    // 225 + labour market integration (64 + 70 = 134) + bachelor's & 3 yrs Canada 25 = 384.
    expect(total()).toHaveTextContent('384');
  });

  it.each([
    ['IELTS', ['Speaking', 'Listening', 'Reading', 'Writing']],
    ['TEF', ['Expression orale', 'Compréhension orale', 'Compréhension écrite', 'Expression écrite']],
  ] as const)('names the four abilities as the %s test report does', (test, names) => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText('Test de la 1re langue officielle'), { target: { value: test } });

    for (const name of names) expect(screen.getByLabelText(`1re langue — ${name}`)).toBeInTheDocument();
  });

  it('flags a second language in the same language as the first as an error', () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText('Test de la 1re langue officielle'), { target: { value: 'IELTS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une 2e langue officielle' }));
    const second = screen.getByLabelText('Test de la 2e langue officielle');
    fireEvent.change(second, { target: { value: 'CELPIP' } });
    for (const skill of ['Speaking', 'Listening', 'Reading', 'Writing']) {
      fireEvent.change(screen.getByLabelText(`1re langue — ${skill}`), { target: { value: '7' } });
      fireEvent.change(screen.getByLabelText(`2e langue — ${skill}`), { target: { value: '7' } });
    }

    expect(second).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/doit être l’autre langue/)).toBeInTheDocument();
  });

  it('suggests what would raise the score most, with the points it would add', () => {
    renderCalculator();
    const hints = within(screen.getByRole('region', { name: 'Comment augmenter votre score' })).getAllByRole('listitem');

    // CLB 9 everywhere: 31×4 = 124 + bachelor's & CLB 9 = 25 → +149.
    expect(hints[0]).toHaveTextContent('NCLC/CLB 9');
    expect(hints[0]).toHaveTextContent('+149');
    // One year in Canada: 40 + bachelor's & 1 yr = 13 → +53.
    expect(hints.some((h) => /expérience canadienne/.test(h.textContent ?? '') && /\+53/.test(h.textContent ?? ''))).toBe(true);
  });

  it('gathers the advice beneath the score in one card: hints, Pack Stanzy for the TCF, disclaimer', () => {
    renderCalculator();
    const advice = screen.getByRole('region', { name: 'Comment augmenter votre score' });

    expect(within(advice).getAllByRole('listitem').length).toBeGreaterThan(0);
    const pack = within(advice).getByRole('link', { name: /Pack Stanzy/ });
    expect(pack).toHaveAttribute('href', 'https://tcf-express-academy.com');
    expect(pack).toHaveAttribute('target', '_blank');
    expect(pack).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(advice).getByText(/Résultat indicatif/)).toBeInTheDocument();
    expect(within(advice).getByRole('link', { name: 'Réserver une consultation' })).toBeInTheDocument();
    // The score card itself no longer carries the disclaimer.
    expect(within(screen.getByRole('complementary', { name: 'Votre score' })).queryByText(/Résultat indicatif/)).toBeNull();
  });

  it('adds the provincial nomination', () => {
    renderCalculator();
    fireEvent.click(screen.getByLabelText(/Désignation provinciale ou territoriale/));
    expect(total()).toHaveTextContent('825');
  });

  it('sends a signed-out visitor to Connexion and back to save', () => {
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma simulation' }));

    expect(router.push).toHaveBeenCalledWith('/connexion?next=%2Foutils%2Fcrs');
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the answers for a signed-in Account', () => {
    signedIn();
    renderCalculator();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma simulation' }));

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ profile: expect.objectContaining({ age: 30, education: 'bachelors' }) }),
      expect.anything(),
    );
  });

  it('keeps the answers on this device across visits', () => {
    const { unmount } = renderCalculator();
    fireEvent.change(screen.getByLabelText('Votre âge'), { target: { value: '29' } });
    unmount();

    renderCalculator();
    expect(screen.getByLabelText('Votre âge')).toHaveValue(29);
    expect(total()).toHaveTextContent('230');
  });

  it.each(['fr', 'en'] as const)('has no axe violations (%s)', async (locale) => {
    const { container } = renderCalculator(locale);
    expect(await axe(container)).toHaveNoViolations();
  });
});
