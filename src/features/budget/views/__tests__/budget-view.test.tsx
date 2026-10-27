// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DEFAULT_ANSWERS, type BudgetAnswers, type Expense } from '@/features/budget/lib/budget-schema';
import { BudgetView } from '@/features/budget/views/budget-view';

/**
 * Seam: the Budget & dépenses page as a visitor and a signed-in User drive
 * it. Only the browser auth client and the tRPC hooks are stubbed. Expected
 * amounts are worked by hand from IRCC's fee page (30 Apr 2026), its
 * proof-of-funds table (7 Jul 2025) and the spec's defaults (1 CAD = 440 XAF,
 * WES 300 CAD, test 210 000 XAF, medical 100 000, police 10 000, passport
 * 110 000, photos 5 000 XAF).
 */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

type Mutation = { mutate: ReturnType<typeof vi.fn>; isPending: boolean; isSuccess: boolean; reset: () => void };
const mutation = (): Mutation => ({ mutate: vi.fn(), isPending: false, isSuccess: false, reset: vi.fn() });
const server = {
  profile: undefined as { currency: string | null; estimate: BudgetAnswers | null } | null | undefined,
  expenses: [] as Expense[],
  setCurrency: mutation(),
  saveEstimate: mutation(),
  add: mutation(),
  update: mutation(),
  remove: mutation(),
};
vi.mock('@/trpc/react', () => ({
  api: {
    useUtils: () => ({
      budget: { profile: { get: { invalidate: vi.fn() } }, expenses: { list: { invalidate: vi.fn() } } },
    }),
    budget: {
      profile: {
        get: {
          useQuery: (_: unknown, opts?: { enabled?: boolean }) =>
            opts?.enabled === false || server.profile === undefined
              ? { data: undefined, isPending: true }
              : { data: server.profile, isPending: false },
        },
        setCurrency: { useMutation: () => server.setCurrency },
        saveEstimate: { useMutation: () => server.saveEstimate },
      },
      expenses: {
        list: {
          useQuery: (_: unknown, opts?: { enabled?: boolean }) =>
            opts?.enabled === false ? { data: undefined, isPending: true } : { data: server.expenses, isPending: false },
        },
        add: { useMutation: () => server.add },
        update: { useMutation: () => server.update },
        delete: { useMutation: () => server.remove },
      },
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-27T15:00:00') });
  window.localStorage.clear();
  window.location.hash = '';
  signedOut();
  server.profile = undefined;
  server.expenses = [];
  server.setCurrency = mutation();
  server.saveEstimate = mutation();
  server.add = mutation();
  server.update = mutation();
  server.remove = mutation();
});
afterEach(() => vi.useRealTimers());

const renderView = () => render(withIntl(<BudgetView />));
const region = (name: string) => screen.getByRole('region', { name });
const fees = () => region('Frais à payer');
const funds = () => region('Fonds à prouver');
const line = (name: string) => within(fees()).getByRole('listitem', { name });
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

/** A couple and one child, both adults taking the TEF, the principal applicant alone getting a WES ECA. */
function answerCoupleWithChild() {
  fireEvent.click(screen.getByLabelText('Mon époux ou conjoint de fait vient avec moi'));
  type(screen.getByLabelText('Enfants à charge qui viennent avec moi'), '1');
  type(screen.getByLabelText('Votre test de langue'), 'TEF');
  fireEvent.click(screen.getByLabelText('Mon époux ou conjoint passe aussi un test'));
}

describe('BudgetView', () => {
  describe('Estimer mon budget', () => {
    it('counts the official IRCC fees per person, with biometrics capped for the family', () => {
      renderView();
      answerCoupleWithChild();
      type(screen.getByLabelText('Devise d’affichage'), 'CAD');

      // 990 × 2 + 600 × 2 + 270 = 1 590 × 2 + 270.
      expect(line('Frais de traitement IRCC (adulte)')).toHaveTextContent('2 × 990 $CA');
      expect(line('Frais de traitement IRCC (adulte)')).toHaveTextContent('1 980 $CA');
      expect(line('Frais de résidence permanente (RPRF)')).toHaveTextContent('1 200 $CA');
      expect(line('Frais de traitement IRCC (enfant à charge)')).toHaveTextContent('270 $CA');
      // 85 × 3 persons = 255, capped at 170.
      expect(line('Biométrie')).toHaveTextContent('170 $CA');
      expect(line('Biométrie')).toHaveTextContent('plafonné à 170 $ CA par famille');
      expect(within(line('Biométrie')).queryByRole('textbox')).toBeNull();
    });

    it('totals the fees for a couple and one child in francs CFA at 1 CAD = 440 FCFA', () => {
      renderView();
      answerCoupleWithChild();

      // IRCC 3 450 CAD = 1 518 000; biometrics 170 CAD = 74 800; WES 300 CAD =
      // 132 000; TEF × 2 = 420 000; medical × 3 = 300 000; police × 2 = 20 000;
      // passport × 3 = 330 000; photos × 3 = 15 000.
      expect(line('Évaluation des diplômes (WES)')).toHaveTextContent('132 000 FCFA');
      expect(line('Test de langue')).toHaveTextContent('420 000 FCFA');
      expect(line('Visite médicale')).toHaveTextContent('300 000 FCFA');
      expect(within(fees()).getByTestId('fees-total')).toHaveTextContent('2 809 800 FCFA');
      expect(line('Visite médicale')).toHaveTextContent('Source : Estimation Stanzy · vérifié le 27 octobre 2026');
    });

    describe('« En savoir plus »', () => {
      const learnMore = (name: string) => within(line(name)).getByRole('button', { name: `En savoir plus\u202f: ${name}` });
      const openGuide = async (name: string) => {
        fireEvent.click(learnMore(name));
        return screen.findByRole('dialog', { name });
      };

      it('is offered on the IRCC fees, biometrics, the medical, the police certificate and the passport, not elsewhere', () => {
        renderView();
        answerCoupleWithChild();

        for (const name of [
          'Frais de traitement IRCC (adulte)',
          'Frais de traitement IRCC (enfant à charge)',
          'Frais de résidence permanente (RPRF)',
          'Biométrie',
          'Visite médicale',
          'Certificat de police',
          'Passeport',
        ]) {
          expect(learnMore(name)).toBeInTheDocument();
        }
        for (const name of ['Évaluation des diplômes (WES)', 'Test de langue', 'Photos d’identité']) {
          expect(within(line(name)).queryByRole('button', { name: /En savoir plus/ })).toBeNull();
        }
      });

      it('explains biometrics: the fee, paid when the application is submitted, and its validity', async () => {
        renderView();
        const guide = await openGuide('Biométrie');

        expect(guide).toHaveTextContent('85 $ CA par personne');
        expect(guide).toHaveTextContent('170 $ CA au maximum par famille');
        expect(guide).toHaveTextContent('payés avec les frais de la demande, au moment de la soumission');
        expect(guide).toHaveTextContent('10 ans');
      });

      it('explains the medical: after the application, a panel physician, 12 months of validity', async () => {
        renderView();
        const guide = await openGuide('Visite médicale');

        expect(guide).toHaveTextContent('après la soumission');
        expect(guide).toHaveTextContent('médecin désigné');
        expect(guide).toHaveTextContent('12 mois');
        // IRCC's own search tool for panel physicians.
        expect(within(guide).getByRole('link', { name: /Trouver un médecin désigné/ })).toHaveAttribute(
          'href',
          'https://secure.cic.gc.ca/PanelPhysicianMedecinDesigne/fr/Accueil',
        );
      });

      it('offers Stanzy’s help for the Cameroon police certificate, on WhatsApp', async () => {
        renderView();
        const guide = await openGuide('Certificat de police');

        expect(guide).toHaveTextContent('Uniquement pour le Cameroun');
        for (const piece of ['Acte de naissance', 'CNI', 'Bulletin n° 3', 'Passeport']) {
          expect(within(guide).getByText(piece, { exact: false })).toBeInTheDocument();
        }
        expect(within(guide).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
          'href',
          expect.stringMatching(/^https:\/\/wa\.me\/message\/H3LTKVCVL6GAL1/),
        );
      });

      it('names the RPRF amount and that it is refunded if the application fails', async () => {
        renderView();
        const guide = await openGuide('Frais de résidence permanente (RPRF)');

        expect(guide).toHaveTextContent('600 $ CA');
        expect(guide).toHaveTextContent('remboursés');
      });
    });

    it('shows the proof of funds apart, never added to the fees, and says when the User is exempt', () => {
      renderView();
      answerCoupleWithChild();

      // 3 persons: 23 360 CAD × 440.
      expect(funds()).toHaveTextContent('10 278 400 FCFA');
      expect(funds()).toHaveTextContent('Pour 3 personnes · soit 23 360 $CA');
      expect(within(fees()).getByTestId('fees-total')).toHaveTextContent('2 809 800 FCFA');

      fireEvent.click(screen.getByLabelText('Je n’ai pas à prouver de fonds (CEC ou offre d’emploi valide)'));
      expect(funds()).toHaveTextContent('Vous n’avez pas à prouver de fonds');
      expect(funds()).not.toHaveTextContent('FCFA');
    });

    it('recomputes the total when a line’s price or the rate is edited', () => {
      renderView();
      answerCoupleWithChild();

      type(screen.getByLabelText('Prix par personne : Visite médicale (XAF)'), '150000');
      // Medical 3 × 150 000 = 450 000 instead of 300 000.
      expect(within(fees()).getByTestId('fees-total')).toHaveTextContent('2 959 800 FCFA');

      type(screen.getByLabelText('Taux de conversion : 1 CAD en XAF'), '450');
      // CAD lines at 450: IRCC 1 552 500 + biometrics 76 500 + WES 135 000;
      // XAF lines unchanged: 420 000 + 450 000 + 20 000 + 330 000 + 15 000.
      expect(within(fees()).getByTestId('fees-total')).toHaveTextContent('2 999 000 FCFA');
    });

    it('remembers the visitor’s estimate in this browser', () => {
      const { unmount } = renderView();
      answerCoupleWithChild();
      type(screen.getByLabelText('Prix par personne : Visite médicale (XAF)'), '150000');
      unmount();

      renderView();
      expect(screen.getByLabelText('Mon époux ou conjoint de fait vient avec moi')).toBeChecked();
      expect(screen.getByLabelText('Prix par personne : Visite médicale (XAF)')).toHaveValue('150000');
      expect(within(fees()).getByTestId('fees-total')).toHaveTextContent('2 959 800 FCFA');
      expect(screen.queryByRole('button', { name: 'Enregistrer dans mon compte' })).toBeNull();
    });

    it('reads a signed-in User’s estimate from their Account and saves it back', () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: { ...DEFAULT_ANSWERS, spouse: true, children: 1 } };
      renderView();

      expect(screen.getByLabelText('Mon époux ou conjoint de fait vient avec moi')).toBeChecked();
      fireEvent.click(screen.getByLabelText('Je n’ai pas à prouver de fonds (CEC ou offre d’emploi valide)'));
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer dans mon compte' }));

      expect(server.saveEstimate.mutate).toHaveBeenCalledWith(
        { estimate: { ...DEFAULT_ANSWERS, spouse: true, children: 1, fundsExempt: true } },
        expect.anything(),
      );
    });

    it('speaks English on the English site', () => {
      render(withIntl(<BudgetView />, 'en'));

      expect(screen.getByRole('tab', { name: 'Estimate my budget' })).toHaveAttribute('aria-selected', 'true');
      // Single applicant, TEF and WES by default: 1 975 CAD × 440 + 435 000 XAF.
      expect(within(screen.getByRole('region', { name: 'Fees to pay' })).getByTestId('fees-total')).toHaveTextContent(
        'FCFA 1,304,000',
      );
    });

    it('has no detectable accessibility violations', async () => {
      vi.useRealTimers();
      const { container } = renderView();
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Mes dépenses', () => {
    const TEF: Expense = { id: 'x1', name: 'TEF Canada', motif: 'languageTest', amount: 210_000, date: '2026-09-12', note: '' };
    const WES: Expense = { id: 'x2', name: 'WES', motif: 'eca', amount: 132_000, date: '2026-10-02', note: 'Licence' };
    const openJournal = () => fireEvent.click(screen.getByRole('tab', { name: 'Mes dépenses' }));
    const form = (name = 'Ajouter une dépense') => within(screen.getByRole('region', { name }));

    it('opens on « Mes dépenses » from the link’s hash', () => {
      window.location.hash = '#depenses';
      renderView();
      expect(screen.getByRole('tab', { name: 'Mes dépenses' })).toHaveAttribute('aria-selected', 'true');
    });

    it('invites a visitor to sign in, coming back to the journal', () => {
      renderView();
      openJournal();

      expect(screen.getByRole('heading', { name: 'Connectez-vous pour tenir votre journal de dépenses' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
        'href',
        '/connexion?next=%2Foutils%2Fbudget%23depenses',
      );
    });

    it('asks a User to choose a currency on first use, XAF by default', async () => {
      signedIn();
      server.profile = null;
      renderView();
      openJournal();

      const dialog = await screen.findByRole('dialog', { name: 'Choisissez votre devise' });
      expect(within(dialog).getByLabelText('Devise')).toHaveValue('XAF');
      type(within(dialog).getByLabelText('Devise'), 'XOF');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));

      expect(server.setCurrency.mutate).toHaveBeenCalledWith({ currency: 'XOF' }, expect.anything());
    });

    it('still asks for a currency when the User only saved an estimate', async () => {
      signedIn();
      server.profile = { currency: null, estimate: DEFAULT_ANSWERS };
      renderView();
      openJournal();

      expect(await screen.findByRole('dialog', { name: 'Choisissez votre devise' })).toBeInTheDocument();
    });

    it('lists Dépenses newest first with the total, subtotals by reason and the budget bar', () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: DEFAULT_ANSWERS };
      server.expenses = [TEF, WES];
      renderView();
      openJournal();

      const cards = within(region('Dépenses enregistrées')).getAllByRole('button', { name: /^Modifier / });
      expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Modifier WES', 'Modifier TEF Canada']);
      expect(cards[0]).toHaveTextContent('132 000 FCFA');
      expect(cards[0]).toHaveTextContent('2 octobre 2026');

      expect(region('Total dépensé')).toHaveTextContent('342 000 FCFA');
      const byMotif = within(region('Par motif'));
      expect(byMotif.getByRole('listitem', { name: 'Test de langue' })).toHaveTextContent('210 000 FCFA');
      expect(byMotif.getByRole('listitem', { name: 'Évaluation des diplômes (ECA)' })).toHaveTextContent('132 000 FCFA');

      // Single TEF + WES default estimate: 1 975 CAD × 440 = 869 000, plus
      // 210 000 + 100 000 + 10 000 + 110 000 + 5 000 = 1 304 000 FCFA.
      expect(region('Total dépensé')).toHaveTextContent('Dépensé 342 000 FCFA sur un budget estimé de 1 304 000 FCFA');
      expect(screen.getByRole('progressbar', { name: 'Part du budget estimé dépensée' })).toHaveAttribute(
        'aria-valuenow',
        '26',
      );
    });

    it('adds a Dépense, then shows it in the total, its reason and the bar', () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: DEFAULT_ANSWERS };
      server.expenses = [TEF];
      server.add.mutate.mockImplementation((input: Omit<Expense, 'id'>, options: { onSuccess: () => void }) => {
        server.expenses = [{ ...input, id: 'x3', note: input.note ?? '' }, ...server.expenses];
        options.onSuccess();
      });
      renderView();
      openJournal();

      type(form().getByLabelText('Nom de la dépense'), 'Frais IRCC');
      type(form().getByLabelText('Motif'), 'irccFees');
      type(form().getByLabelText('Montant (XAF)'), '699 600');
      type(form().getByLabelText('Date'), '2026-10-20');
      fireEvent.click(form().getByRole('button', { name: 'Ajouter la dépense' }));

      expect(server.add.mutate).toHaveBeenCalledWith(
        { name: 'Frais IRCC', motif: 'irccFees', amount: 699_600, date: '2026-10-20', note: '' },
        expect.anything(),
      );
      // 210 000 + 699 600.
      expect(region('Total dépensé')).toHaveTextContent('Dépensé 909 600 FCFA sur un budget estimé de 1 304 000 FCFA');
      expect(within(region('Par motif')).getByRole('listitem', { name: 'Frais IRCC' })).toHaveTextContent('699 600 FCFA');
      expect(screen.getByRole('progressbar', { name: 'Part du budget estimé dépensée' })).toHaveAttribute(
        'aria-valuenow',
        '70',
      );
    });

    it('keeps cents for a currency that has them', () => {
      signedIn();
      server.profile = { currency: 'CAD', estimate: null };
      renderView();
      openJournal();

      type(form().getByLabelText('Nom de la dépense'), 'Frais IRCC');
      type(form().getByLabelText('Montant (CAD)'), '1 590,50');
      type(form().getByLabelText('Date'), '2026-10-20');
      fireEvent.click(form().getByRole('button', { name: 'Ajouter la dépense' }));

      expect(server.add.mutate).toHaveBeenCalledWith(expect.objectContaining({ amount: 159_050 }), expect.anything());
    });

    it('asks for a name, an amount and a past date before saving', () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: null };
      renderView();
      openJournal();

      fireEvent.click(form().getByRole('button', { name: 'Ajouter la dépense' }));
      expect(form().getByText('Donnez un nom à la dépense.')).toBeInTheDocument();
      expect(form().getByText('Indiquez un montant supérieur à zéro.')).toBeInTheDocument();
      expect(form().getByText('Indiquez la date de la dépense.')).toBeInTheDocument();

      type(form().getByLabelText('Date'), '2026-10-28');
      fireEvent.click(form().getByRole('button', { name: 'Ajouter la dépense' }));
      expect(form().getByText('La date ne peut pas être dans le futur.')).toBeInTheDocument();
      expect(server.add.mutate).not.toHaveBeenCalled();
    });

    it('edits a Dépense in place and deletes one only once the User confirms', async () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: null };
      server.expenses = [WES, TEF];
      renderView();
      openJournal();

      fireEvent.click(screen.getByRole('button', { name: 'Modifier TEF Canada' }));
      const edit = form('Modifier la dépense');
      expect(edit.getByLabelText('Montant (XAF)')).toHaveValue('210000');
      type(edit.getByLabelText('Montant (XAF)'), '215000');
      fireEvent.click(edit.getByRole('button', { name: 'Enregistrer les modifications' }));
      expect(server.update.mutate).toHaveBeenCalledWith(
        { id: 'x1', name: 'TEF Canada', motif: 'languageTest', amount: 215_000, date: '2026-09-12', note: '' },
        expect.anything(),
      );

      fireEvent.click(edit.getByRole('button', { name: 'Supprimer cette dépense' }));
      const confirm = await screen.findByRole('alertdialog', { name: 'Supprimer cette dépense ?' });
      expect(confirm).toHaveTextContent('« TEF Canada » sera retirée de votre journal.');
      expect(server.remove.mutate).not.toHaveBeenCalled();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
      expect(server.remove.mutate).toHaveBeenCalledWith({ id: 'x1' }, expect.anything());
    });

    it('warns that amounts aren’t converted when the User changes currency', async () => {
      signedIn();
      server.profile = { currency: 'XAF', estimate: null };
      server.expenses = [TEF];
      renderView();
      openJournal();

      fireEvent.click(screen.getByRole('button', { name: 'Changer de devise' }));
      const dialog = await screen.findByRole('dialog', { name: 'Changer de devise' });
      expect(dialog).toHaveTextContent('Les montants déjà saisis ne sont pas convertis');
      type(within(dialog).getByLabelText('Devise'), 'EUR');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));

      expect(server.setCurrency.mutate).toHaveBeenCalledWith({ currency: 'EUR' }, expect.anything());
    });

    it('has no detectable accessibility violations', async () => {
      vi.useRealTimers();
      signedIn();
      server.profile = { currency: 'XAF', estimate: DEFAULT_ANSWERS };
      server.expenses = [TEF, WES];
      const { container } = renderView();
      openJournal();
      expect(await axe(container)).toHaveNoViolations();
    });

    describe('on a phone', () => {
      beforeEach(() => {
        vi.spyOn(window, 'matchMedia').mockImplementation(
          (query: string) => ({ matches: query === '(max-width: 1023px)', media: query }) as MediaQueryList,
        );
      });
      afterEach(() => vi.restoreAllMocks());

      it('adds from the floating button in a drawer', async () => {
        signedIn();
        server.profile = { currency: 'XAF', estimate: null };
        renderView();
        openJournal();

        fireEvent.click(screen.getByRole('button', { name: 'Ajouter une dépense' }));
        const drawer = await screen.findByRole('dialog', { name: 'Ajouter une dépense' });
        type(within(drawer).getByLabelText('Nom de la dépense'), 'Passeport');
        type(within(drawer).getByLabelText('Motif'), 'passport');
        type(within(drawer).getByLabelText('Montant (XAF)'), '110000');
        type(within(drawer).getByLabelText('Date'), '2026-08-03');
        await act(async () => {
          fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter la dépense' }));
        });

        expect(server.add.mutate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Passeport', motif: 'passport', amount: 110_000 }),
          expect.anything(),
        );
      });
    });
  });
});
