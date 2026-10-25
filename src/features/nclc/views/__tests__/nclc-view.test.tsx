// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { NclcView } from '@/features/nclc/views/nclc-view';

/** Seam: the Calculateur NCLC / CLB page as a visitor uses it. */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

beforeEach(() => {
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
  window.localStorage.clear();
});

const chooseTest = (label: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Quel test avez-vous passé ?' }), {
    target: { value: label },
  });
const type = (field: RegExp, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: field }), { target: { value } });
const result = () => screen.getByRole('region', { name: 'Votre niveau' });
const levelOf = (skill: string) => within(result()).getByText(skill).closest('li');
const retained = () => within(result()).getByText('Niveau retenu (le plus faible)').nextElementSibling;

function enterTcf() {
  chooseTest('TCF');
  type(/Compréhension orale \(sur 699\)/, '690');
  type(/Compréhension écrite \(sur 699\)/, '699');
  type(/Expression orale \(sur 20\)/, '19');
  type(/Expression écrite \(sur 20\)/, '12');
}

describe('NclcView', () => {
  it('converts TCF Canada scores to NCLC, skill by skill, and keeps the weakest', () => {
    render(withIntl(<NclcView />));
    expect(screen.getByRole('heading', { level: 1, name: /Calculateur NCLC \/ CLB/ })).toBeInTheDocument();

    enterTcf();

    expect(within(result()).getByText('TCF Canada · Français')).toBeInTheDocument();
    expect(retained()).toHaveTextContent('NCLC 8');
    expect(levelOf('Compréhension orale')).toHaveTextContent('NCLC 10');
    expect(levelOf('Expression écrite')).toHaveTextContent('NCLC 8');
    expect(within(result()).getByText(/125 pts CRS/)).toHaveTextContent('+25 pts de bonus francophone');
  });

  it('announces the result as it changes, like the other calculators', () => {
    render(withIntl(<NclcView />));
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Entrez vos 4 notes');

    enterTcf();

    expect(within(live).getByRole('region', { name: 'Votre niveau' })).toBeInTheDocument();
  });

  it('scores an English test in CLB, with no French bonus', () => {
    render(withIntl(<NclcView />));
    chooseTest('CELPIP');
    type(/Speaking \(sur 12\)/, '5');
    type(/Listening \(sur 12\)/, '5');
    type(/Reading \(sur 12\)/, '4');
    type(/Writing \(sur 12\)/, '4');

    expect(retained()).toHaveTextContent('CLB 4');
    expect(levelOf('Speaking')).toHaveTextContent('CLB 5');
    expect(within(result()).getByText(/24 pts CRS/)).not.toHaveTextContent('bonus');
  });

  it('keeps the form to one card: the test, then the four scores', () => {
    render(withIntl(<NclcView />));
    const form = screen.getByRole('region', { name: 'Vos résultats de test' });

    expect(within(form).getByRole('combobox', { name: 'Quel test avez-vous passé ?' })).toBeInTheDocument();
    expect(within(form).getAllByRole('textbox')).toHaveLength(4);
    expect(screen.queryByText(/Étape/)).not.toBeInTheDocument();
  });

  describe('Travailleurs qualifiés verdict', () => {
    const verdict = () => within(result()).getByRole('note');

    it('says when the level meets Travailleurs qualifiés', () => {
      render(withIntl(<NclcView />));
      enterTcf();

      expect(verdict()).toHaveTextContent('Admissible aux Travailleurs qualifiés (fédéral)');
      expect(within(verdict()).queryByRole('link')).not.toBeInTheDocument();
    });

    it('says « presque » at NCLC 6, naming the skills to raise', () => {
      render(withIntl(<NclcView />));
      chooseTest('TCF');
      type(/Compréhension orale \(sur 699\)/, '458');
      type(/Compréhension écrite \(sur 699\)/, '453');
      type(/Expression orale \(sur 20\)/, '9');
      type(/Expression écrite \(sur 20\)/, '7');

      expect(verdict()).toHaveAttribute('data-status', 'close');
      expect(verdict()).toHaveTextContent('Presque');
      expect(verdict()).toHaveTextContent('Expression orale et Expression écrite');
    });

    it('says « pas admissible » below NCLC 6 and offers TCF preparation', () => {
      render(withIntl(<NclcView />));
      chooseTest('TCF');
      type(/Compréhension orale \(sur 699\)/, '549');
      type(/Compréhension écrite \(sur 699\)/, '406');
      type(/Expression orale \(sur 20\)/, '6');
      type(/Expression écrite \(sur 20\)/, '12');

      expect(verdict()).toHaveAttribute('data-status', 'notEligible');
      expect(verdict()).toHaveTextContent('Pas encore admissible aux Travailleurs qualifiés (fédéral)');
      expect(verdict()).toHaveTextContent('Expression orale et Compréhension écrite');
      expect(within(verdict()).getByRole('link', { name: /Préparer le TCF/ })).toHaveAttribute(
        'href',
        'https://tcf-express-academy.com',
      );
    });

    it('offers no French preparation for an English test', () => {
      render(withIntl(<NclcView />));
      chooseTest('CELPIP');
      for (const field of [/Speaking/, /Listening/, /Reading/, /Writing/]) type(field, '4');

      expect(verdict()).toHaveAttribute('data-status', 'notEligible');
      expect(within(verdict()).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  it('flags a score the test cannot give, and shows no level', () => {
    render(withIntl(<NclcView />));
    chooseTest('TCF');
    type(/Compréhension orale \(sur 699\)/, '700');
    type(/Compréhension écrite \(sur 699\)/, '500');
    type(/Expression orale \(sur 20\)/, '10');
    type(/Expression écrite \(sur 20\)/, '10');

    expect(screen.getByText('Ce résultat n’existe pas pour ce test.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Votre niveau' })).not.toBeInTheDocument();
  });

  it('keeps the scores for the next visit', () => {
    const { unmount } = render(withIntl(<NclcView />));
    enterTcf();
    unmount();

    render(withIntl(<NclcView />));

    expect(screen.getByRole('textbox', { name: /Expression écrite \(sur 20\)/ })).toHaveValue('12');
    expect(levelOf('Expression écrite')).toHaveTextContent('NCLC 8');
  });

  it('ends with the « À savoir » band pointing to the CRS calculator', () => {
    render(withIntl(<NclcView />));
    const guide = screen.getByRole('region', { name: 'Un bon niveau NCLC / CLB n’est que la première étape.' });

    expect(within(guide).getByRole('link', { name: 'Réserver une consultation' })).toBeInTheDocument();
    expect(within(guide).getByRole('link', { name: 'Calculer mon score CRS' })).toHaveAttribute('href', '/outils/crs');
  });

  it('has no axe violations with a result on screen', async () => {
    render(withIntl(<NclcView />));
    enterTcf();
    expect(await axe(result())).toHaveNoViolations();
  });
});
