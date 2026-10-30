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

const ANSWERS_KEY = 'stanzy.checklist.answers.v2';
const READY_KEY = 'stanzy.checklist.ready.v2';

/** A single candidate: one job abroad, one country. */
const SINGLE: ChecklistForm = {
  ...DEFAULT_CHECKLIST_FORM,
  jobs: [{ title: 'Responsable QHSE', inCanada: false, selfEmployed: false }],
  countries: ['Cameroun'],
};
/** A married couple coming with two children. */
const FAMILY: ChecklistForm = {
  ...SINGLE,
  maritalStatus: 'married',
  spouseAccompanying: true,
  children: 2,
  spouseJobs: ['Commerciale'],
  spouseCountries: ['Cameroun'],
};

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
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const personBlock = (name: string | RegExp) => screen.getByRole('region', { name });
/** A slot of a person's block, found by its heading. */
const slotRow = (block: HTMLElement, name: string | RegExp) =>
  within(block).getByRole('heading', { level: 3, name }).closest('li')!;
/** The documents of a slot, by their buttons. */
const documentsOf = (slot: HTMLElement) =>
  within(slot)
    .getAllByRole('listitem')
    .map((row) => within(row).getAllByRole('button')[0]!.textContent);

describe('Checklist form', () => {
  it('says what the list gives, IRCC’s official fees included', async () => {
    page(<ChecklistFormView />);

    const intro = screen.getByRole('region', { name: 'Ce que vous obtenez' });
    expect(within(intro).getByRole('heading', { name: 'Les frais officiels d’IRCC' })).toBeInTheDocument();
    expect(within(intro).getByRole('heading', { name: 'Une liste comme celle d’IRCC' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Poste 1')).toBeInTheDocument();
  });

  it('asks for each job and country by name, and hands the answers to the list', async () => {
    page(<ChecklistFormView />);

    fireEvent.change(await screen.findByLabelText('Votre état matrimonial'), { target: { value: 'married' } });
    fireEvent.click(check('Mon époux(se) ou conjoint(e) vient avec moi au Canada'));
    type('Enfants à charge', '2');
    fireEvent.change(screen.getAllByLabelText('Poste 1')[0]!, { target: { value: 'Responsable QHSE' } });
    fireEvent.change(screen.getAllByLabelText('Pays 1')[0]!, { target: { value: 'Cameroun' } });
    // The spouse's part: one job, one country.
    const spouse = screen.getByRole('region', { name: 'Votre conjoint(e)' });
    fireEvent.click(within(spouse).getByRole('button', { name: 'Ajouter un emploi' }));
    fireEvent.change(within(spouse).getByLabelText('Poste 1'), { target: { value: 'Commerciale' } });
    fireEvent.change(within(spouse).getByLabelText('Pays 1'), { target: { value: 'Cameroun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(router.push).toHaveBeenCalledWith('/outils/checklist/liste');
    expect(JSON.parse(window.localStorage.getItem(ANSWERS_KEY)!)).toEqual(FAMILY);
  });

  it('sums up the file beside the form as the answers change', async () => {
    page(<ChecklistFormView />);
    const file = await screen.findByRole('complementary', { name: 'Votre dossier' });
    const before = Number(within(file).getByText(/^\d+$/).textContent);
    expect(file).toHaveTextContent('Requérant principal');
    expect(file).toHaveTextContent(/1\s*675,00\s*\$/); // 990 + 600 + 85

    type('Enfants à charge', '1');

    expect(file).toHaveTextContent('Enfant 1');
    // A child's passport, photo, medical exam and birth certificate.
    expect(Number(within(file).getByText(/^\d+$/).textContent)).toBe(before + 4);
    expect(file).toHaveTextContent(/2\s*030,00\s*\$/); // + 270, biometrics at the family rate
  });

  it('won’t continue with a job or a country left unnamed', async () => {
    page(<ChecklistFormView />);
    await screen.findByLabelText('Poste 1');

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Complétez les champs signalés pour continuer.');
    expect(screen.getByLabelText('Poste 1')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Pays 1')).toHaveAccessibleDescription('Indiquez le pays.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('adds and removes jobs and countries', async () => {
    page(<ChecklistFormView />);
    await screen.findByLabelText('Poste 1');

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un emploi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un pays' }));
    expect(screen.getByLabelText('Poste 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Pays 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le pays 2' }));
    expect(screen.queryByLabelText('Pays 2')).not.toBeInTheDocument();
    // The last country can't be removed.
    expect(screen.queryByRole('button', { name: 'Retirer le pays 1' })).not.toBeInTheDocument();
  });

  it('starts from the CRS calculator’s answers on this device', async () => {
    window.localStorage.setItem('stanzy.crs.draft.v1', JSON.stringify({ ...DEFAULT_FORM, maritalStatus: 'married', canadianWorkYears: 1 }));
    page(<ChecklistFormView />);

    expect(await screen.findByText('Pré-rempli avec vos réponses du Calculateur CRS. Vérifiez et complétez.')).toBeInTheDocument();
    expect(screen.getByLabelText('Votre état matrimonial')).toHaveValue('married');
    expect(check('J’ai au moins un an d’expérience qualifiée au Canada')).toBeChecked();
    // The Canadian job is there, to name.
    expect(screen.getByLabelText('Poste 1')).toHaveValue('');
    expect(check('Au Canada')).toBeChecked();
  });

  it('reopens on its own answers kept in this browser, over the CRS draft', async () => {
    window.localStorage.setItem('stanzy.crs.draft.v1', JSON.stringify({ ...DEFAULT_FORM, maritalStatus: 'divorced' }));
    keepAnswers(FAMILY);
    page(<ChecklistFormView />);

    expect(await screen.findByLabelText('Enfants à charge')).toHaveValue('2');
    expect(screen.getAllByLabelText('Poste 1')[0]).toHaveValue('Responsable QHSE');
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
      server.checklist = { answers: SINGLE, ready: [] };
      server.simulations = [{ id: 'sim_1', name: 'Profil avec Kemi', total: 471, updatedAt: new Date('2026-10-20') }];
      page(<ChecklistFormView />);

      expect(await screen.findByLabelText('Poste 1')).toHaveValue('Responsable QHSE');
      fireEvent.click(check('J’ai une offre d’emploi d’un employeur canadien'));
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

      expect(router.push).toHaveBeenCalledWith('/outils/checklist/liste');
      await waitFor(() => expect(server.saveAnswers).toHaveBeenCalledWith({ ...SINGLE, jobOffer: true }));
    });
  });
});

describe('Checklist list', () => {
  it('sends a visitor without answers to the form', async () => {
    page(<ChecklistView />);

    expect(await screen.findByText('Votre checklist n’est pas encore prête')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remplir le formulaire' })).toHaveAttribute('href', '/outils/checklist');
  });

  it('gives each person their block: principal applicant, spouse, then each child', async () => {
    keepAnswers(FAMILY);
    page(<ChecklistView />);

    await screen.findByRole('region', { name: 'Requérant principal : documents justificatifs' });
    expect(screen.getAllByRole('heading', { level: 2 }).slice(0, 6).map((h) => h.textContent)).toEqual([
      'Votre avancement',
      'Requérant principal : documents justificatifs',
      'Conjoint(e) : documents justificatifs',
      'Enfant 1 : documents justificatifs',
      'Enfant 2 : documents justificatifs',
      'Frais',
    ]);
    const principal = personBlock('Requérant principal : documents justificatifs');
    expect(within(principal).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '*Passeports/titres de voyage(requis)',
      '*Certificat de mariage/permis(requis)',
      '*Preuve d’examen médical préalable(requis)',
      '*Études (diplômes ou grades universitaires)(requis)',
      '*Relevé d’emploi – Responsable QHSE(requis)',
      '*Certificat de police – Cameroun(requis)',
      '*Preuve de ressources financières suffisantes(requis)',
      '*Photographie(requis)',
      'Documents optionnels',
      '*Renseignements du client(requis)',
    ]);
    const child = personBlock('Enfant 2 : documents justificatifs');
    expect(within(child).getByRole('heading', { level: 3, name: /Enregistrement\/certificat naissance/ })).toBeInTheDocument();
    expect(
      within(personBlock('Conjoint(e) : documents justificatifs')).getByRole('heading', { level: 3, name: /Relevé d’emploi – Commerciale/ }),
    ).toBeInTheDocument();
  });

  it('lists a job’s documents, the letter starred and the rest recommended', async () => {
    keepAnswers(SINGLE);
    page(<ChecklistView />);

    const job = slotRow(await screen.findByRole('region', { name: /Requérant principal/ }), /Relevé d’emploi – Responsable QHSE/);
    expect(documentsOf(job)).toEqual([
      'Lettres de référence des employeurs',
      'Fiches de paie',
      'Contrat de travail',
      'Attestation de sécurité sociale',
      'Relevés du compte de salaire',
    ]);
    const rows = within(job).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('★Obligatoire');
    for (const row of rows.slice(1)) expect(row).toHaveTextContent('Recommandé');
  });

  it('groups the ECA, the diploma, the transcripts and the language test under « Études »', async () => {
    keepAnswers(SINGLE);
    page(<ChecklistView />);

    const studies = slotRow(await screen.findByRole('region', { name: /Requérant principal/ }), /Études/);
    expect(documentsOf(studies)).toEqual([
      'Évaluation des diplômes d’études (EDE)',
      'Diplômes et attestations de diplôme',
      'Résultats du test de langue',
      'Relevés de notes',
    ]);
  });

  it('opens a document’s guide in a dialog', async () => {
    keepAnswers(SINGLE);
    page(<ChecklistView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Lettres de référence des employeurs' }));

    const dialog = await screen.findByRole('dialog', { name: 'Lettres de référence des employeurs' });
    expect(within(dialog).getByRole('heading', { name: 'Ce que la lettre doit contenir' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Relevé d’emploi – Responsable QHSE · Requérant principal');
    expect(within(dialog).getByRole('link', { name: 'Faire vérifier mes lettres par Stanzy' })).toHaveAttribute('href', '/services/verification');
  });

  it('links each person from the progress card to their block', async () => {
    keepAnswers(FAMILY);
    page(<ChecklistView />);

    const progress = await screen.findByRole('region', { name: 'Votre avancement' });
    expect(within(progress).getByRole('link', { name: 'Aller à : Enfant 2' })).toHaveAttribute('href', '#person-child2');
    expect(document.getElementById('person-child2')).toHaveAccessibleName('Enfant 2 : documents justificatifs');
    expect(within(progress).getByRole('link', { name: /Frais officiels IRCC/ })).toHaveTextContent(/3\s*890,00\s*\$/);
  });

  it('shows IRCC’s fees for the family', async () => {
    keepAnswers(FAMILY);
    page(<ChecklistView />);

    const fees = await screen.findByRole('region', { name: 'Frais' });
    expect(within(fees).getByRole('row', { name: /pour un enfant/ })).toHaveTextContent(/2\s*270,00\s*\$\s*540,00\s*\$/);
    // 990 + 600 + 170 + 990 + 600 + 540
    expect(within(fees).getByRole('row', { name: /Prix total/ })).toHaveTextContent(/3\s*890,00\s*\$/);
  });

  it('ticks a visitor’s documents « Prêt » in this browser, with the progress', async () => {
    keepAnswers(SINGLE);
    page(<ChecklistView />);
    const progress = await screen.findByRole('progressbar', { name: 'Documents prêts' });
    expect(progress).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(check('Prêt : Passeport – Passeports/titres de voyage (Requérant principal)'));

    expect(check('Prêt : Passeport – Passeports/titres de voyage (Requérant principal)')).toBeChecked();
    expect(progress).not.toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/^1 sur \d+ documents prêts$/)).toBeInTheDocument();
    expect(slotRow(personBlock(/Requérant principal/), /Passeports/)).toHaveTextContent('Prêt');
    expect(JSON.parse(window.localStorage.getItem(READY_KEY)!)).toEqual(['principal:passport:passport']);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
  });

  describe('for a signed-in User', () => {
    beforeEach(signedIn);

    it('shows the ticks saved in the Account and saves a new one', async () => {
      server.checklist = { answers: SINGLE, ready: ['principal:passport:passport'] };
      page(<ChecklistView />);

      expect(await screen.findByRole('checkbox', { name: /^Prêt : Passeport –/ })).toBeChecked();
      fireEvent.click(check(/^Prêt : Fiches de paie – Relevé d’emploi – Responsable QHSE/));

      await waitFor(() => expect(check(/^Prêt : Fiches de paie/)).toBeChecked());
      expect(server.setReady).toHaveBeenCalledWith({ key: 'principal:job-0:payslips', ready: true });
      expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    });

    it('unticks a refused tick and says so', async () => {
      server.checklist = { answers: SINGLE, ready: [] };
      server.setReady = vi.fn(async () => {
        throw new Error('offline');
      });
      page(<ChecklistView />);

      fireEvent.click(await screen.findByRole('checkbox', { name: /^Prêt : Passeport –/ }));

      expect(await screen.findByText('Le document n’a pas pu être coché. Réessayez.')).toBeInTheDocument();
      expect(check(/^Prêt : Passeport –/)).not.toBeChecked();
    });

    it('builds the list from this device’s answers before any were saved', async () => {
      keepAnswers(FAMILY);
      page(<ChecklistView />);

      expect(await screen.findByRole('region', { name: 'Conjoint(e) : documents justificatifs' })).toBeInTheDocument();
    });
  });

  it('has no detectable accessibility violations', async () => {
    keepAnswers(FAMILY);
    const { container } = page(<ChecklistView />);
    await screen.findByRole('region', { name: /Requérant principal/ });
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);
});
