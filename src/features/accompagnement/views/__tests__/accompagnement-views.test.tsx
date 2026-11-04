// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DEFAULT_CHECKLIST_FORM } from '@/features/checklist/lib/checklist-form';
import { AREAS, DEFAULT_PROGRESS } from '@/features/accompagnement/lib/interest-schema';
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
  it('goes through the three steps and sends the answers', async () => {
    const submit = vi.fn();
    const { container } = client({ latest: null, dossierId: null }, { 'accompagnement.submit': (input) => submit(input) ?? { id: 'int_1' } });
    expect(screen.getByText('Étape 1 sur 3 : Votre situation')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByText('Étape 2 sur 3 : Où vous en êtes')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nationalité'), { target: { value: 'Camerounaise' } });
    fireEvent.change(screen.getByLabelText('Test de langue passé'), { target: { value: 'tcf' } });
    fireEvent.click(screen.getByLabelText('J’ai fait mon EDE (WES, IQAS…)'));
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByText('Étape 3 sur 3 : Vos documents')).toBeInTheDocument();
    const funds = screen.getByRole('group', { name: 'Preuve de fonds' });
    fireEvent.click(within(funds).getByLabelText('Stanzy s’en charge'));
    fireEvent.change(within(funds).getByLabelText(/Note sur/), { target: { value: 'Relevé de 4 mois' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        checklist: saved,
        progress: { ...DEFAULT_PROGRESS, citizenship: 'Camerounaise', languageTest: 'tcf', ede: true },
        areas: expect.objectContaining({ funds: { answer: 'stanzy', note: 'Relevé de 4 mois' } }),
      }),
    );
  });

  it('offers « Stanzy s’en charge » only from Cameroon', async () => {
    client({ latest: null, dossierId: null });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    fireEvent.change(await screen.findByLabelText('Nationalité'), { target: { value: 'Camerounaise' } });
    fireEvent.change(screen.getByLabelText('Pays de résidence'), { target: { value: 'CA' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(await screen.findByText('Étape 3 sur 3 : Vos documents')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stanzy s’en charge')).not.toBeInTheDocument();
  });

  it('says where a sent Demande stands', () => {
    const { unmount } = client({
      latest: { id: 'int_1', status: 'SUBMITTED', rejectReason: null, dossierId: null, createdAt: new Date('2026-11-04'), decidedAt: null },
      dossierId: null,
    });
    expect(screen.getByText(/est à l’étude/)).toBeInTheDocument();
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
    expect(screen.getByText('Le dossier s’ouvrira à l’étape « Création du profil Entrée Express ».')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('Niveau retenu'), { target: { value: 'C' } });
    expect(screen.getByText('Le dossier s’ouvrira à l’étape « Dans le bassin ».')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter et ouvrir le dossier' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith({ id: 'int_1', level: 'C' }));
  });
});
