// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DEFAULT_AVAILABILITY } from '@/features/consultation/lib/availability';
import { ConsultationAdminView } from '@/features/consultation/views/consultation-admin-view';
import { ConsultationsDashboardView } from '@/features/consultation/views/consultations-dashboard-view';
import { createTestTRPC, type Handlers } from '@/trpc/__tests__/test-utils';
import type { RouterOutputs } from '@/trpc/types';

type Listing = RouterOutputs['consultationAdmin']['list'];
type Detail = RouterOutputs['consultationAdmin']['detail'];

const IN_TWO_DAYS = new Date(Date.now() + 2 * 86_400_000);
const client = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', status: 'LEAD' as const, locale: 'fr' };

const LIST: Listing = {
  counts: { upcoming: 2, failed: 1 },
  failed: [],
  rows: [
    { id: 'con_1', status: 'PAID', startsAt: IN_TWO_DAYS, durationMinutes: 45, heldUntil: null, crsScore: 452, client, network: 'MTN Mobile Money', card: false, meetingId: 'meet_1' },
    {
      id: 'con_2',
      status: 'HELD',
      startsAt: new Date(IN_TWO_DAYS.getTime() + 86_400_000),
      durationMinutes: 45,
      heldUntil: new Date(Date.now() + 9 * 60_000),
      crsScore: null,
      client: { ...client, id: 'acc_2', name: 'Grace Nkeng', status: 'USER' as const },
      network: null,
      card: false,
      meetingId: null,
    },
  ],
};
const FAILED: Listing = {
  counts: LIST.counts,
  rows: [],
  failed: [
    { id: 'pay_f', at: new Date(), consultationId: 'con_3', client: { ...client, id: 'acc_3', name: 'Joseph Nana' }, wanted: IN_TWO_DAYS, network: 'Orange Money', refusedAtOnce: false, paidLater: false, minutesToPaid: null, released: true },
  ],
};
const SETTINGS = { ...DEFAULT_AVAILABILITY, weeklyHours: [{ day: 1, start: '09:00', end: '12:00' }, { day: 1, start: '14:00', end: '16:00' }], price: null };

function renderList(handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'consultationAdmin.list': ({ tab }: { tab: string }) => (tab === 'failed' ? FAILED : LIST),
    'consultationAdmin.settings': () => SETTINGS,
    ...handlers,
  });
  queryClient.setQueryData(trpc.consultationAdmin.list.queryKey({ tab: 'upcoming' }), LIST);
  queryClient.setQueryData(trpc.consultationAdmin.settings.queryKey(), SETTINGS);
  return render(withIntl(wrap(<ConsultationsDashboardView />)));
}

beforeEach(() => vi.clearAllMocks());

describe('Tableau de bord → Consultations', () => {
  it('lists those to come, paid or held, with the tabs’ counts', async () => {
    const { container } = renderList();
    expect(screen.getByRole('tab', { name: 'À venir · 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Paiements échoués · 1' })).toBeInTheDocument();
    expect(screen.getAllByText('Payée · MTN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('En attente · gardé 9 min').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lead · CRS 452').length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the failed payments, and what happened next', async () => {
    renderList();
    fireEvent.click(screen.getByRole('tab', { name: 'Paiements échoués · 1' }));
    const failed = within(await screen.findByRole('region', { name: 'Paiements échoués' }));
    expect(failed.getByText('Joseph Nana')).toBeInTheDocument();
    expect(failed.getByText('Refusé · Orange')).toBeInTheDocument();
    expect(failed.getByRole('link', { name: 'Voir le Compte' })).toHaveAttribute('href', '/comptes/acc_3');
  });

  it('saves the Disponibilités: several ranges a day, and the price', async () => {
    const save = vi.fn(() => ({ saved: true }));
    renderList({ 'consultationAdmin.saveSettings': save });
    const panel = within(screen.getByRole('region', { name: 'Disponibilités' }));
    expect(panel.getByDisplayValue('09:00 – 12:00 · 14:00 – 16:00')).toBeInTheDocument();
    expect(panel.getByText('Sans tarif, le paiement reste fermé.')).toBeInTheDocument();
    fireEvent.change(panel.getByRole('textbox', { name: /^Tarif/ }), { target: { value: '12345' } });
    fireEvent.click(panel.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 12_345,
          weeklyHours: [
            { day: 1, start: '09:00', end: '12:00' },
            { day: 1, start: '14:00', end: '16:00' },
          ],
        }),
      ),
    );
  });

  it('says which day’s hours it cannot read, and saves nothing', () => {
    const save = vi.fn();
    renderList({ 'consultationAdmin.saveSettings': save });
    const panel = within(screen.getByRole('region', { name: 'Disponibilités' }));
    fireEvent.change(panel.getByDisplayValue('09:00 – 12:00 · 14:00 – 16:00'), { target: { value: 'le matin' } });
    fireEvent.click(panel.getByRole('button', { name: 'Enregistrer' }));
    expect(panel.getByRole('alert')).toHaveTextContent('Une plage n’est pas lisible');
    expect(save).not.toHaveBeenCalled();
  });
});

const DETAIL: Detail = {
  id: 'con_1',
  status: 'PAID',
  startsAt: IN_TWO_DAYS,
  durationMinutes: 45,
  heldUntil: null,
  ended: false,
  answers: { topics: ['eligibility', 'points'], crsScore: 452, itaReceived: false, situation: 'Infirmière, 31 ans, TCF passé en mars.' },
  client: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', status: 'LEAD', phone: '+237677123456', country: 'CM', dossiers: 0 },
  payment: {
    id: '0b8f6a3e-4b5d-4c1e-9a2f-5d6e7f8a9b0c',
    price: 12_345,
    discount: 0,
    promo: null,
    amount: 12_345,
    fee: 587,
    charged: 12_932,
    currency: 'XAF',
    network: 'mtn_cm',
    networkName: 'MTN Mobile Money',
    settledAt: new Date(),
    invoiceNumber: 'STZ-2026-0007',
  },
  meeting: { id: 'meet_1', notes: null, remindedDayBefore: null, remindedSoon: null, endedAt: null, status: 'SCHEDULED' },
};

function renderDetail(handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultationAdmin.detail': () => DETAIL, ...handlers });
  queryClient.setQueryData(trpc.consultationAdmin.detail.queryKey({ id: 'con_1' }), DETAIL);
  return render(withIntl(wrap(<ConsultationAdminView id="con_1" />)));
}

describe('Tableau de bord → a Consultation', () => {
  it('shows what Aminata prepared, the payment with its Facture, and « Rejoindre » closed until 15 minutes before', async () => {
    const { container } = renderDetail();
    expect(screen.getByRole('heading', { name: 'Ce qu’Aminata a préparé' })).toBeInTheDocument();
    expect(screen.getByText('452')).toBeInTheDocument();
    expect(screen.getByText(/« Infirmière, 31 ans/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Facture payée STZ-2026-0007/ })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: 'Rejoindre' })).not.toBeInTheDocument();
    expect(screen.getByText(/S’ouvre à/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('saves the private notes a moment after typing stops', async () => {
    const saveNotes = vi.fn(() => ({ saved: true }));
    renderDetail({ 'consultationAdmin.saveNotes': saveNotes });
    fireEvent.change(screen.getByRole('textbox', { name: 'Vos notes' }), { target: { value: 'Comparer EE et PNP.' } });
    await waitFor(() => expect(saveNotes).toHaveBeenCalledWith({ id: 'con_1', notes: 'Comparer EE et PNP.' }), { timeout: 2000 });
    expect(saveNotes).toHaveBeenCalledTimes(1);
  });

  it('« Annuler ce créneau » shows the next free slot and needs a reason', async () => {
    const cancelSlot = vi.fn(() => ({ startsAt: new Date(IN_TWO_DAYS.getTime() + 3600_000) }));
    renderDetail({
      'consultationAdmin.moveOptions': () => ({ days: [], next: new Date(IN_TWO_DAYS.getTime() + 3600_000).toISOString() }),
      'consultationAdmin.cancelSlot': cancelSlot,
    });
    fireEvent.click(screen.getByRole('button', { name: /Annuler ce créneau/ }));
    expect(await screen.findByText(/Aminata passera au prochain créneau libre/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Annuler et déplacer' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Motif, dit au Client' }), { target: { value: 'Un empêchement.' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(cancelSlot).toHaveBeenCalledWith({ id: 'con_1', reason: 'Un empêchement.' }));
  });
});
