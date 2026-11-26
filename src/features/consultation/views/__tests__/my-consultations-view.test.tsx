// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { MyConsultationView } from '@/features/consultation/views/my-consultation-view';
import { MyConsultationsView } from '@/features/consultation/views/my-consultations-view';
import { createTestTRPC, type Handlers } from '@/trpc/__tests__/test-utils';
import type { RouterOutputs } from '@/trpc/types';

vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/mon-espace/consultations',
  useRouter: () => ({ push: vi.fn() }),
}));

type List = RouterOutputs['consultationSpace']['list'];
type Detail = RouterOutputs['consultationSpace']['detail'];

const IN_TWO_DAYS = new Date(Date.now() + 2 * 86_400_000);
const LAST_MONTH = new Date(Date.now() - 30 * 86_400_000);
const base = { durationMinutes: 45, minutes: 45, meetingId: 'meet_1', paymentId: 'pay_1', pendingNetwork: null, steps: { total: 0, done: 0 } };

const LIST: List = {
  upcoming: [{ ...base, id: 'con_1', status: 'PAID', startsAt: IN_TWO_DAYS, over: false, published: false, paid: { amount: 15_713, currency: 'XAF', network: 'MTN Mobile Money' } }],
  past: [{ ...base, id: 'con_0', status: 'PAID', startsAt: LAST_MONTH, minutes: 42, over: true, published: true, paid: null, steps: { total: 3, done: 1 } }],
};

function renderList(list: List = LIST) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultationSpace.list': () => list });
  queryClient.setQueryData(trpc.consultationSpace.list.queryKey(), list);
  return render(withIntl(wrap(<MyConsultationsView />)));
}

const BEFORE: Detail = {
  id: 'con_1',
  startsAt: IN_TWO_DAYS,
  durationMinutes: 45,
  minutes: 45,
  over: false,
  meetingId: 'meet_1',
  moveUntil: new Date(IN_TWO_DAYS.getTime() - 24 * 3_600_000),
  canMove: true,
  moveCutoffHours: 24,
  answers: { topics: ['eligibility'], crsScore: 452, itaReceived: false, situation: null },
  payment: { id: 'pay_1', amount: 15_713, currency: 'XAF', network: 'MTN Mobile Money', promo: null, invoiceNumber: 'STZ-2026-0007' },
  published: null,
};
const AFTER: Detail = {
  ...BEFORE,
  startsAt: LAST_MONTH,
  over: true,
  canMove: false,
  minutes: 44,
  published: {
    at: new Date(),
    recording: { seconds: 2652 },
    transcript: 'Bonjour Aminata.',
    notes: [{ id: 'note_1', atSeconds: 160, text: 'Votre profil est admissible à Entrée express.' }],
    steps: [{ id: 'step_1', text: 'Passer le test de langue', doneAt: null }],
  },
};

function renderDetail(detail: Detail, handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultationSpace.detail': () => detail, ...handlers });
  queryClient.setQueryData(trpc.consultationSpace.detail.queryKey({ id: detail.id }), detail);
  return render(withIntl(wrap(<MyConsultationView id={detail.id} />)));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Mon espace → Mes consultations', () => {
  it('lists the ones to come and the past ones, each with its next step', async () => {
    const { container } = renderList();
    const upcoming = within(screen.getByRole('region', { name: 'À venir' }));
    expect(upcoming.getByText('Payée 15 713 FCFA')).toBeInTheDocument();
    expect(upcoming.getByRole('link', { name: 'Préparer' })).toHaveAttribute('href', '/mon-espace/consultations/con_1');
    const past = within(screen.getByRole('region', { name: 'Passées' }));
    expect(past.getByText('Enregistrement disponible')).toBeInTheDocument();
    expect(past.getByText(/3 prochaines étapes, 1 faites/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says there is none yet, with Stanzy', () => {
    renderList({ upcoming: [], past: [] });
    expect(screen.getByRole('heading', { name: 'Pas encore de consultation.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calculer mon score CRS' })).toHaveAttribute('href', '/outils/crs');
  });
});

describe('Mon espace → a Consultation', () => {
  it('before: what is ready, the camera test, the Facture and « Déplacer »', async () => {
    const { container } = renderDetail(BEFORE);
    expect(screen.getByText('Vos réponses sont chez Stanzy')).toBeInTheDocument();
    expect(screen.getByText('1 sur 2 fait')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Facture payée STZ-2026-0007/ })).toHaveAttribute('href', '/api/consultation/invoices/pay_1');
    expect(screen.getByRole('button', { name: 'Déplacer le créneau' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves to a free slot it picks', async () => {
    const day = new Date(IN_TWO_DAYS.getTime() + 86_400_000).toISOString().slice(0, 10);
    const start = `${day}T10:00:00.000Z`;
    const move = vi.fn(() => ({ startsAt: new Date(start) }));
    renderDetail(BEFORE, { 'consultationSpace.moveOptions': () => ({ days: [{ day, starts: [start] }] }), 'consultationSpace.move': move });
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer le créneau' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(await dialog.findByRole('radio', { name: '11:00' }));
    fireEvent.click(dialog.getByRole('button', { name: /^Déplacer à/ }));
    await waitFor(() => expect(move).toHaveBeenCalledWith({ id: 'con_1', start }));
  });

  it('after, once published: the video with its repères, Stanzy’s notes, and the steps to tick', async () => {
    const toggleStep = vi.fn(() => ({ done: true }));
    renderDetail(AFTER, { 'consultationSpace.toggleStep': toggleStep });
    expect(screen.getByText('Vidéo avec Stanzy · 44 min · enregistrée avec votre accord')).toBeInTheDocument();
    expect(document.querySelector('video')).toHaveAttribute('src', '/api/consultation/recordings/con_1');
    expect(screen.getByRole('button', { name: 'Aller à 2:40' })).toBeInTheDocument();
    expect(screen.getByText('Votre profil est admissible à Entrée express.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Passer le test de langue' }));
    await waitFor(() => expect(toggleStep).toHaveBeenCalledWith({ id: 'con_1', stepId: 'step_1', done: true }));
    expect(screen.getByRole('link', { name: 'Envoyer ma demande' })).toHaveAttribute('href', '/services/accompagnement');
  });

  it('after, before publishing: Stanzy is preparing the recap', () => {
    renderDetail({ ...AFTER, published: null });
    expect(screen.getByText(/Stanzy prépare votre récapitulatif/)).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });
});
