// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DEFAULT_CHECKLIST_FORM } from '@/features/checklist/lib/checklist-form';
import { AREAS, DEFAULT_PROGRESS } from '@/features/accompagnement/lib/interest-schema';
import { DossierOverviewView } from '@/features/accompagnement/views/dossier-overview-view';
import { InterestDashboardView } from '@/features/accompagnement/views/interest-dashboard-view';
import { InterestView } from '@/features/accompagnement/views/interest-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Demande d'intérêt screens with their data in the cache, as the routes prefetch it. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => vi.clearAllMocks());

const saved = {
  ...DEFAULT_CHECKLIST_FORM,
  jobs: [{ title: 'Comptable', inCanada: false, selfEmployed: false }],
  countries: ['Cameroun'],
};

/** The contact and experience step (#147): their phone, then the one job's company, CNP code and start. */
async function fillWork() {
  expect(await screen.findByText('Étape 3 sur 5 : Contact et expériences')).toBeInTheDocument();
  const job = screen.getByRole('group', { name: 'Comptable' });
  fireEvent.change(screen.getByLabelText('Numéro de téléphone (WhatsApp de préférence)'), {
    target: { value: '+237 692 24 53 94' },
  });
  fireEvent.change(within(job).getByLabelText('Nom de l’entreprise'), { target: { value: 'Brasseries du Cameroun' } });
  fireEvent.change(within(job).getByLabelText('Code CNP (5 chiffres)'), { target: { value: '11100' } });
  fireEvent.change(within(job).getByLabelText('Début'), { target: { value: '2019-03-01' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
}

function client(mine: unknown, handlers: Record<string, (input: never) => unknown> = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'accompagnement.mine': () => mine,
    'checklist.get': () => ({ answers: saved, ready: [] }),
    'crs.list': () => [],
    ...handlers,
  });
  queryClient.setQueryData(trpc.accompagnement.mine.queryKey(), mine as never);
  queryClient.setQueryData(trpc.checklist.get.queryKey(), { answers: saved, ready: [] } as never);
  queryClient.setQueryData(trpc.crs.list.queryKey(), [] as never);
  return render(withIntl(wrap(<InterestView />)));
}

describe('the Demande d’intérêt, for the User', () => {
  it('goes through the five steps, their CRS scored as they go, and sends the answers', async () => {
    const submit = vi.fn();
    const { container } = client({ latest: null, dossierId: null }, { 'accompagnement.submit': (input) => submit(input) ?? { id: 'int_1' } });
    expect(screen.getByText('Étape 1 sur 5 : Votre situation')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByText('Étape 2 sur 5 : Où vous en êtes')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nationalité'), { target: { value: 'Camerounaise' } });
    fireEvent.change(screen.getByLabelText('Test de langue passé'), { target: { value: 'tcf' } });
    fireEvent.click(screen.getByLabelText('J’ai fait mon EDE (WES, IQAS…)'));
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    await fillWork();
    expect(await screen.findByText('Étape 4 sur 5 : Votre score CRS')).toBeInTheDocument();
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent(/\d+/);
    const before = live.textContent;
    fireEvent.click(screen.getByLabelText(/Désignation provinciale/));
    expect(screen.getByRole('status').textContent).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByText('Étape 5 sur 5 : Vos documents')).toBeInTheDocument();
    const funds = screen.getByRole('group', { name: 'Preuve de fonds' });
    fireEvent.click(within(funds).getByLabelText('Stanzy s’en charge'));
    fireEvent.change(within(funds).getByLabelText(/Note sur/), { target: { value: 'Relevé de 4 mois' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        checklist: saved,
        progress: { ...DEFAULT_PROGRESS, citizenship: 'Camerounaise', languageTest: 'tcf', ede: true },
        work: {
          phone: '+237 692 24 53 94',
          experiences: [
            { title: 'Comptable', company: 'Brasseries du Cameroun', cnp: '11100', startOn: '2019-03-01', endOn: null },
          ],
        },
        areas: expect.objectContaining({ funds: { answer: 'stanzy', note: 'Relevé de 4 mois' } }),
        crs: expect.objectContaining({ age: 30, provincialNomination: true }),
      }),
    );
  });

  it('offers « Stanzy s’en charge » only from Cameroon', async () => {
    client({ latest: null, dossierId: null });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    fireEvent.change(await screen.findByLabelText('Nationalité'), { target: { value: 'Camerounaise' } });
    fireEvent.change(screen.getByLabelText('Pays de résidence'), { target: { value: 'CA' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    await fillWork();
    fireEvent.click(await screen.findByRole('button', { name: /Continuer/ }));
    expect(await screen.findByText('Étape 5 sur 5 : Vos documents')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stanzy s’en charge')).not.toBeInTheDocument();
  });

  it('asks for a phone, a 5-digit CNP code and an end after the start before going on', async () => {
    const { container } = client({ latest: null, dossierId: null });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    fireEvent.change(await screen.findByLabelText('Nationalité'), { target: { value: 'Camerounaise' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(await screen.findByText('Étape 3 sur 5 : Contact et expériences')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chercher un code CNP/ })).toHaveAttribute('href', 'https://noc.esdc.gc.ca/');
    expect(await axe(container)).toHaveNoViolations();

    const job = screen.getByRole('group', { name: 'Comptable' });
    fireEvent.change(within(job).getByLabelText('Code CNP (5 chiffres)'), { target: { value: '111' } });
    fireEvent.change(within(job).getByLabelText('Début'), { target: { value: '2019-03-01' } });
    fireEvent.click(within(job).getByLabelText('J’y travaille encore'));
    fireEvent.change(within(job).getByLabelText('Fin'), { target: { value: '2018-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/code CNP à 5 chiffres/);
    expect(screen.getByLabelText('Numéro de téléphone (WhatsApp de préférence)')).toHaveAttribute('aria-invalid', 'true');
    expect(within(job).getByLabelText('Code CNP (5 chiffres)')).toHaveAttribute('aria-invalid', 'true');
    expect(within(job).getByLabelText('Fin')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Étape 3 sur 5 : Contact et expériences')).toBeInTheDocument();
  }, 30_000);

  it('says where a sent Demande stands', () => {
    const { unmount } = client({
      latest: {
        id: 'int_1',
        status: 'SUBMITTED',
        rejectReason: null,
        dossierId: null,
        createdAt: new Date('2026-11-04'),
        decidedAt: null,
        crsScore: 478,
      },
      dossierId: null,
    });
    expect(screen.getByText(/est à l’étude/)).toBeInTheDocument();
    // The end of the form: their CRS score.
    expect(screen.getByRole('heading', { name: 'Votre score CRS' }).parentElement).toHaveTextContent('478 points');
    unmount();
    client({ latest: null, dossierId: 'dos_1' });
    expect(screen.getByRole('link', { name: 'Ouvrir mon dossier' })).toHaveAttribute('href', '/fr/mon-espace/dossiers/dos_1');
  });
});

describe('a Demande d’intérêt, for the consultant', () => {
  const interest = {
    id: 'int_1',
    status: 'SUBMITTED',
    level: 'B',
    levelOverride: null,
    createdAt: new Date('2026-11-04'),
    decidedAt: null,
    dossierId: null,
    residence: 'CM',
    rejectReason: null,
    decidedBy: null,
    account: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', status: 'LEAD' },
    answers: {
      checklist: saved,
      progress: { ...DEFAULT_PROGRESS, citizenship: 'Camerounaise', languageTest: 'tcf', ede: true },
      work: {
        phone: '+237 692 24 53 94',
        experiences: [{ title: 'Comptable', company: 'Brasseries du Cameroun', cnp: '11100', startOn: '2019-03-01', endOn: null }],
      },
      areas: Object.fromEntries(AREAS.map((area) => [area, { answer: area === 'funds' ? 'missing' : 'have', note: area === 'funds' ? 'Relevé de 4 mois' : '' }])),
    },
    history: [],
  };

  it('shows the answers and opens the Dossier at the Niveau chosen', async () => {
    const approve = vi.fn();
    const { trpc, queryClient, wrap } = createTestTRPC({
      'accompagnement.dashboard.get': () => interest,
      'accompagnement.dashboard.approve': (input) => approve(input) ?? { id: 'dos_1' },
    });
    queryClient.setQueryData(trpc.accompagnement.dashboard.get.queryKey({ id: 'int_1' }), interest as never);
    const { container } = render(withIntl(wrap(<InterestDashboardView id="int_1" />)));

    expect(screen.getByRole('heading', { name: 'Aminata Diallo' })).toBeInTheDocument();
    expect(screen.getByText('Relevé de 4 mois')).toBeInTheDocument();
    // Their phone and each job (#147).
    expect(screen.getByText('+237 692 24 53 94')).toBeInTheDocument();
    expect(screen.getByText('Comptable · Brasseries du Cameroun')).toBeInTheDocument();
    expect(screen.getByText('CNP 11100 · 2019-03-01 → en cours')).toBeInTheDocument();
    expect(screen.getByText('Le dossier s’ouvrira à l’étape « Création du profil Entrée Express ».')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('Niveau retenu'), { target: { value: 'C' } });
    expect(screen.getByText('Le dossier s’ouvrira à l’étape « Dans le bassin ».')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter et ouvrir le dossier' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith({ id: 'int_1', level: 'C' }));
  });

  it('once approved, sends the Contrat d’accompagnement first, then the invoice', () => {
    const approved = { ...interest, status: 'APPROVED', dossierId: 'dos_1', decidedAt: new Date('2026-11-05') };
    const { trpc, queryClient, wrap } = createTestTRPC({ 'accompagnement.dashboard.get': () => approved });
    queryClient.setQueryData(trpc.accompagnement.dashboard.get.queryKey({ id: 'int_1' }), approved as never);
    render(withIntl(wrap(<InterestDashboardView id="int_1" />)));

    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links.indexOf('Envoyer le contrat d’accompagnement')).toBeLessThan(links.indexOf('Créer la facture'));
    expect(screen.getByRole('link', { name: 'Envoyer le contrat d’accompagnement' })).toHaveAttribute(
      'href',
      expect.stringContaining('/dossiers/dos_1?onglet=facturation&contrat=nouveau'),
    );
  });
});

describe('the Accompagnement Dossier’s Aperçu', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  function overview(viewer: 'consultant' | 'client', data: unknown, handlers: Record<string, (input: never) => unknown> = {}) {
    const { trpc, queryClient, wrap } = createTestTRPC({ 'accompagnement.overview': () => data, ...handlers });
    queryClient.setQueryData(trpc.accompagnement.overview.queryKey({ dossierId: 'dos_1' }), data as never);
    return render(withIntl(wrap(<DossierOverviewView dossierId="dos_1" viewer={viewer} />)));
  }

  it('shows the Client their CRS score and the days left of the 60 since the ITA', async () => {
    const { container } = overview('client', { crsScore: 478, itaDate: daysAgo(10), open: true });
    expect(screen.getByText('478')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /jours restants/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Date de l’ITA')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says when the 60 days are over', () => {
    overview('client', { crsScore: null, itaDate: daysAgo(90), open: true });
    expect(screen.getByText(/Le délai de 60 jours est dépassé/)).toBeInTheDocument();
  });

  it('lets the consultant set the ITA date once it arrives', async () => {
    const set = vi.fn();
    overview('consultant', { crsScore: 478, itaDate: null, open: true }, {
      'accompagnement.dashboard.setItaDate': (input) => set(input),
    });
    expect(screen.getByText(/Pas encore d’ITA/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date de l’ITA'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(set).toHaveBeenCalledWith({ dossierId: 'dos_1', itaDate: '2026-11-01' }));
  });

  it('shows nothing for another service', () => {
    const { container } = overview('client', null);
    expect(container).toBeEmptyDOMElement();
  });
});
