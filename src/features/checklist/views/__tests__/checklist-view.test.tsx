// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, router, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DEFAULT_CHECKLIST_FORM, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { ChecklistFormView } from '@/features/checklist/views/checklist-form-view';
import { ChecklistView } from '@/features/checklist/views/checklist-view';
import { DEFAULT_FORM, toProfile } from '@/features/crs/lib/crs-form';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the Checklist Entrée Express pages as a visitor and a signed-in User
 * drive them. Only the browser auth client and the server's answers are
 * stubbed.
 */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

const ANSWERS_KEY = 'stanzy.checklist.answers.v1';
const READY_KEY = 'stanzy.checklist.ready.v1';

/** A married candidate with two children, the spouse coming too. */
const FAMILY: ChecklistForm = { ...DEFAULT_CHECKLIST_FORM, maritalStatus: 'married', spouseAccompanying: true, children: 2, policeCountries: 2 };

/** The server's side for a signed-in User. */
const server = {
  checklist: null as { answers: ChecklistForm | null; ready: string[] } | null,
  simulations: [] as { id: string; name: string; total: number; updatedAt: Date }[],
  saveAnswers: vi.fn(),
  setReady: vi.fn(),
};

const useSession = vi.mocked(authClient.useSession);
const signedIn = () =>
  useSession.mockReturnValue({
    data: { user: { name: 'Aminata', email: 'aminata@example.com' }, session: {} },
    isPending: false,
  } as never);

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  useSession.mockReturnValue({ data: null, isPending: false } as never);
  server.checklist = null;
  server.simulations = [];
  server.saveAnswers = vi.fn(async () => undefined);
  server.setReady = vi.fn(async ({ key, ready }: { key: string; ready: boolean }) => {
    const others = (server.checklist?.ready ?? []).filter((k) => k !== key);
    server.checklist = { answers: server.checklist?.answers ?? null, ready: ready ? [...others, key] : others };
    return server.checklist.ready;
  });
});

/** A page as its route serves it; the User's data is fetched in the browser, answered by `server`. */
const page = (view: React.ReactNode) => {
  const { wrap } = createTestTRPC({
    'checklist.get': () => server.checklist,
    'checklist.saveAnswers': (input) => server.saveAnswers(input),
    'checklist.setReady': (input) => server.setReady(input),
    'crs.list': () => server.simulations,
    'crs.get': ({ id }: { id: string }) => ({
      id,
      name: 'Profil avec Kemi',
      total: 471,
      updatedAt: new Date('2026-10-20'),
      profile: toProfile({ ...DEFAULT_FORM, maritalStatus: 'commonLaw', spouseAccompanying: true, canadianWorkYears: 2 }),
      breakdown: {},
    }),
  });
  return render(withIntl(wrap(view)));
};
const keepAnswers = (answers: ChecklistForm) => window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
const check = (name: string | RegExp) => screen.getByRole('checkbox', { name });
const section = (name: string) => screen.getByRole('region', { name });

describe('Checklist form', () => {
  it('asks about the family, and hands the answers to the list on « Continuer »', async () => {
    page(<ChecklistFormView />);

    fireEvent.change(await screen.findByLabelText('Votre état matrimonial'), { target: { value: 'married' } });
    fireEvent.click(check('Mon époux(se) ou conjoint(e) vient avec moi au Canada'));
    fireEvent.change(screen.getByLabelText('Enfants à charge'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nombre de pays'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(router.push).toHaveBeenCalledWith('/outils/checklist/liste');
    expect(JSON.parse(window.localStorage.getItem(ANSWERS_KEY)!)).toEqual(FAMILY);
  });

  it('only asks about the spouse when there is one', async () => {
    page(<ChecklistFormView />);
    await screen.findByLabelText('Votre état matrimonial');

    expect(screen.queryByRole('checkbox', { name: /vient avec moi au Canada/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Votre état matrimonial'), { target: { value: 'commonLaw' } });
    expect(check(/vient avec moi au Canada/)).toBeInTheDocument();
  });

  it('starts from the CRS calculator’s answers on this device', async () => {
    window.localStorage.setItem('stanzy.crs.draft.v1', JSON.stringify({ ...DEFAULT_FORM, maritalStatus: 'married', canadianWorkYears: 1 }));
    page(<ChecklistFormView />);

    expect(await screen.findByText('Pré-rempli avec vos réponses du Calculateur CRS. Vérifiez et complétez.')).toBeInTheDocument();
    expect(screen.getByLabelText('Votre état matrimonial')).toHaveValue('married');
    expect(check('J’ai au moins un an d’expérience qualifiée au Canada')).toBeChecked();
  });

  it('reopens on its own answers kept in this browser, over the CRS draft', async () => {
    window.localStorage.setItem('stanzy.crs.draft.v1', JSON.stringify({ ...DEFAULT_FORM, maritalStatus: 'divorced' }));
    keepAnswers(FAMILY);
    page(<ChecklistFormView />);

    expect(await screen.findByLabelText('Enfants à charge')).toHaveValue('2');
    expect(screen.getByLabelText('Votre état matrimonial')).toHaveValue('married');
    expect(screen.queryByText(/Pré-rempli/)).not.toBeInTheDocument();
  });

  describe('for a signed-in User', () => {
    beforeEach(signedIn);

    it('starts from their latest saved CRS Simulation', async () => {
      server.simulations = [{ id: 'sim_1', name: 'Profil avec Kemi', total: 471, updatedAt: new Date('2026-10-20') }];
      page(<ChecklistFormView />);

      expect(await screen.findByText('Pré-rempli avec votre simulation CRS « Profil avec Kemi ». Vérifiez et complétez.')).toBeInTheDocument();
      expect(screen.getByLabelText('Votre état matrimonial')).toHaveValue('commonLaw');
      expect(check('Mon époux(se) ou conjoint(e) vient avec moi au Canada')).toBeChecked();
      expect(check('J’ai au moins un an d’expérience qualifiée au Canada')).toBeChecked();
    });

    it('reopens on the answers saved in the Account, and saves them there on « Continuer »', async () => {
      server.checklist = { answers: FAMILY, ready: [] };
      server.simulations = [{ id: 'sim_1', name: 'Profil avec Kemi', total: 471, updatedAt: new Date('2026-10-20') }];
      page(<ChecklistFormView />);

      expect(await screen.findByLabelText('Enfants à charge')).toHaveValue('2');
      fireEvent.click(check('J’ai une offre d’emploi d’un employeur canadien'));
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

      expect(router.push).toHaveBeenCalledWith('/outils/checklist/liste');
      await waitFor(() => expect(server.saveAnswers).toHaveBeenCalledWith({ ...FAMILY, jobOffer: true }));
    });
  });
});

describe('Checklist list', () => {
  it('sends a visitor without answers to the form', async () => {
    page(<ChecklistView />);

    expect(await screen.findByText('Votre checklist n’est pas encore prête')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remplir le formulaire' })).toHaveAttribute('href', '/outils/checklist');
  });

  it('lists the documents section by section, mandatory ones starred', async () => {
    keepAnswers(FAMILY);
    page(<ChecklistView />);

    const identity = await screen.findByRole('region', { name: 'Identité et état civil' });
    const passport = within(identity).getAllByRole('listitem')[0]!;
    expect(passport).toHaveTextContent('Passeport');
    expect(passport).toHaveTextContent('★Obligatoire');

    const birth = within(identity)
      .getAllByRole('listitem')
      .filter((row) => within(row).queryByRole('button', { name: /Acte de naissance/ }));
    expect(birth.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Acte de naissance.*★Obligatoire.*Enfants× 2/),
      expect.stringMatching(/Acte de naissance.*Recommandé/),
      expect.stringMatching(/Acte de naissance.*Recommandé.*Conjoint\(e\)/),
    ]);
    expect(within(section('Certificats de police')).getAllByRole('listitem')[0]).toHaveTextContent('× 2');
    expect(within(section('Identité et état civil')).getByRole('button', { name: /Acte de mariage/ })).toBeInTheDocument();
  });

  it('opens a document’s guide in a dialog', async () => {
    keepAnswers(FAMILY);
    page(<ChecklistView />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Lettres de référence des employeurs' }))[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Lettres de référence des employeurs' });
    expect(within(dialog).getByRole('heading', { name: 'Ce que la lettre doit contenir' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Le nombre d’heures de travail par semaine.');
    expect(within(dialog).getByRole('link', { name: 'Faire vérifier mes lettres par Stanzy' })).toHaveAttribute('href', '/services/verification');
  });

  it('ticks a visitor’s documents « Prêt » in this browser, with the progress', async () => {
    keepAnswers(DEFAULT_CHECKLIST_FORM);
    page(<ChecklistView />);
    const progress = await screen.findByRole('progressbar', { name: 'Documents prêts' });
    expect(progress).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(check('Passeport (Vous) : prêt'));

    expect(check('Passeport (Vous) : prêt')).toBeChecked();
    expect(progress).not.toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/^1 sur \d+ documents prêts$/)).toBeInTheDocument();
    expect(screen.getByText(/^1 sur \d+ documents obligatoires$/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(READY_KEY)!)).toEqual(['you:passport']);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
  });

  describe('for a signed-in User', () => {
    beforeEach(signedIn);

    it('shows the ticks saved in the Account and saves a new one', async () => {
      server.checklist = { answers: DEFAULT_CHECKLIST_FORM, ready: ['you:passport'] };
      page(<ChecklistView />);

      expect(await screen.findByRole('checkbox', { name: 'Passeport (Vous) : prêt' })).toBeChecked();
      fireEvent.click(check('Photo numérique (Vous) : prêt'));

      await waitFor(() => expect(check('Photo numérique (Vous) : prêt')).toBeChecked());
      expect(server.setReady).toHaveBeenCalledWith({ key: 'you:photo', ready: true });
      expect(server.checklist?.ready).toEqual(['you:passport', 'you:photo']);
      expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    });

    it('unticks a refused tick and says so', async () => {
      server.checklist = { answers: DEFAULT_CHECKLIST_FORM, ready: [] };
      server.setReady = vi.fn(async () => {
        throw new Error('offline');
      });
      page(<ChecklistView />);

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Passeport (Vous) : prêt' }));

      expect(await screen.findByText('Le document n’a pas pu être coché. Réessayez.')).toBeInTheDocument();
      expect(check('Passeport (Vous) : prêt')).not.toBeChecked();
    });

    it('builds the list from this device’s answers before any were saved', async () => {
      keepAnswers(FAMILY);
      page(<ChecklistView />);

      expect(await screen.findByRole('region', { name: 'Identité et état civil' })).toHaveTextContent('Acte de mariage');
    });
  });

  it('has no detectable accessibility violations', async () => {
    keepAnswers(FAMILY);
    const { container } = page(<ChecklistView />);
    await screen.findByRole('region', { name: 'Identité et état civil' });
    expect(await axe(container)).toHaveNoViolations();
  }, 20_000);
});
