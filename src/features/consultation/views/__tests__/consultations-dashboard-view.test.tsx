// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    { id: 'con_1', status: 'PAID', startsAt: IN_TWO_DAYS, durationMinutes: 45, heldUntil: null, crsScore: 452, topics: ['eligibility', 'points'], client, network: 'MTN Mobile Money', card: false, meetingId: 'meet_1' },
    {
      id: 'con_2',
      status: 'HELD',
      startsAt: new Date(IN_TWO_DAYS.getTime() + 86_400_000),
      durationMinutes: 45,
      heldUntil: new Date(Date.now() + 9 * 60_000),
      crsScore: null,
      topics: [],
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
    expect(screen.getByText('Mon admissibilité · Gagner des points CRS')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Disponibilités' })).not.toBeInTheDocument();
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

  it('« Disponibilités »: a day’s slots on its timeline, « + » adds one, then everything is saved', async () => {
    const save = vi.fn(() => ({ saved: true }));
    renderList({ 'consultationAdmin.saveSettings': save });
    fireEvent.click(screen.getByRole('radio', { name: 'Disponibilités' }));
    await screen.findByRole('region', { name: 'Horaires de la semaine' });
    const monday = within(screen.getByRole('group', { name: 'lundi' }));
    expect(monday.getByRole('button', { name: '9h–12h, modifier' })).toBeInTheDocument();
    expect(monday.getByRole('button', { name: '14h–16h, modifier' })).toBeInTheDocument();
    expect(screen.getByText('Sans tarif, le paiement reste fermé.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une plage le lundi' }));
    // 12h–13h touches 9h–12h: they become one slot.
    expect(monday.getByRole('button', { name: '9h–13h, modifier' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^Tarif/ }), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 12_345,
          weeklyHours: [
            { day: 1, start: '09:00', end: '13:00' },
            { day: 1, start: '14:00', end: '16:00' },
          ],
        }),
      ),
    );
  });

  it('on a phone, a day opens its sheet: another slot, copied to Friday, saved at once', async () => {
    const save = vi.fn(() => ({ saved: true }));
    renderList({ 'consultationAdmin.saveSettings': save });
    fireEvent.click(screen.getByRole('radio', { name: 'Disponibilités' }));
    fireEvent.click(await screen.findByRole('button', { name: /^lundi/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'lundi' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Ajouter une plage' }));
    fireEvent.click(sheet.getByRole('checkbox', { name: 'vendredi' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const hours = (save.mock.calls[0] as unknown as [{ weeklyHours: { day: number }[] }])[0].weeklyHours;
    expect(hours.filter((h) => h.day === 1)).toEqual([
      { day: 1, start: '09:00', end: '13:00' },
      { day: 1, start: '14:00', end: '16:00' },
    ]);
    expect(hours.filter((h) => h.day === 5)).toHaveLength(2);
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
  meeting: { id: 'meet_1', notes: null, remindedDayBefore: null, remindedSoon: null, endedAt: null, status: 'SCHEDULED', createdAt: new Date(Date.now() - 3 * 86_400_000) },
  over: false,
  recording: null,
  clientNotes: [],
  nextSteps: [],
  publishedAt: null,
};

const AFTER: Detail = {
  ...DETAIL,
  startsAt: new Date(Date.now() - 2 * 3_600_000),
  ended: true,
  over: true,
  recording: { id: 'rec_1', seconds: 44 * 60 + 12, transcript: 'Bonjour Aminata, parlons de votre profil.' },
  clientNotes: [
    { id: 'note_1', atSeconds: 160, text: 'Votre profil est admissible à Entrée express.' },
    { id: 'note_2', atSeconds: null, text: 'Gardez vos relevés de notes.' },
  ],
  nextSteps: [
    { id: 'step_1', text: 'Passer le test de langue', doneAt: null },
    { id: 'step_2', text: 'Faire évaluer votre diplôme', doneAt: new Date() },
  ],
};

function renderDetail(handlers: Handlers = {}, detail: Detail = DETAIL) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultationAdmin.detail': () => detail, ...handlers });
  queryClient.setQueryData(trpc.consultationAdmin.detail.queryKey({ id: 'con_1' }), detail);
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

  it('shows the Déroulé: paid, the reminders planned, then the Consultation', () => {
    renderDetail();
    const timeline = within(screen.getByRole('region', { name: 'Déroulé' }));
    expect(timeline.getByText('Réservée et payée')).toBeInTheDocument();
    expect(timeline.getByText('Rappel e-mail la veille')).toBeInTheDocument();
    expect(timeline.getAllByText(/^Prévu /)).toHaveLength(2);
    expect(screen.queryByText('Rappels envoyés')).not.toBeInTheDocument();
  });

  it('« ⋯ » sends the confirmation again', async () => {
    const resendConfirmation = vi.fn(() => ({ sent: true }));
    renderDetail({ 'consultationAdmin.resendConfirmation': resendConfirmation });
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renvoyer la confirmation/ }));
    await waitFor(() => expect(resendConfirmation).toHaveBeenCalledWith({ id: 'con_1' }));
    expect(await screen.findByText('Confirmation renvoyée à aminata@example.com')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Annuler ce créneau/ }));
    expect(await screen.findByText(/Aminata passera au prochain créneau libre/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Annuler et déplacer' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Motif, dit au Client' }), { target: { value: 'Un empêchement.' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(cancelSlot).toHaveBeenCalledWith({ id: 'con_1', reason: 'Un empêchement.' }));
  });
});

type Week = RouterOutputs['consultationAdmin']['calendar'];

// Thursday 26 November 2026, 11:20 in Douala (UTC+1).
const THURSDAY = new Date('2026-11-26T10:20:00Z');
const douala = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`);
const WEEK: Week = {
  week: '2026-11-23',
  consultations: [
    { id: 'con_past', status: 'PAID', startsAt: douala('2026-11-23', '10:00'), durationMinutes: 45, heldUntil: null, name: 'Paul Mbarga' },
    { id: 'con_held', status: 'HELD', startsAt: douala('2026-11-27', '09:00'), durationMinutes: 45, heldUntil: new Date(THURSDAY.getTime() + 9 * 60_000), name: 'Grace Nkeng' },
    { id: 'con_paid', status: 'PAID', startsAt: douala('2026-11-27', '11:00'), durationMinutes: 45, heldUntil: null, name: 'Richil Stanley Nouping Nouping' },
  ],
  meetings: [{ id: 'meet_9', subject: 'Signature', startsAt: douala('2026-11-26', '15:00'), durationMinutes: 60 }],
};

describe('Tableau de bord → a Consultation, « 2 Après »', () => {
  it('shows the recording with its repères, the notes for the Client, the next steps and what their space will show', async () => {
    const { container } = renderDetail({}, AFTER);
    expect(screen.getByText('Terminée · 44 min')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Déplacer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aller à 2:40' })).toBeInTheDocument();
    expect(screen.getByText('Votre profil est admissible à Entrée express.')).toBeInTheDocument();
    expect(screen.getByText('Faire évaluer votre diplôme')).toHaveClass('line-through');
    const space = within(screen.getByRole('region', { name: 'Dans son espace' }));
    expect(space.getByText('2 notes · 1 repère')).toBeInTheDocument();
    expect(space.getByText('Jamais partagées')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Transcription' }));
    expect(screen.getByText('Bonjour Aminata, parlons de votre profil.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds a note for the Client and a next step', async () => {
    const saveClientNote = vi.fn(() => ({ id: 'note_3' }));
    const saveNextStep = vi.fn(() => ({ id: 'step_3' }));
    renderDetail({ 'consultationAdmin.saveClientNote': saveClientNote, 'consultationAdmin.saveNextStep': saveNextStep }, AFTER);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une note au moment de la vidéo/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /Note, lue par le Client/ }), { target: { value: 'Comparer EE et PNP.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(saveClientNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'con_1', text: 'Comparer EE et PNP.' })));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une étape/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Étape' }), { target: { value: 'Créer votre profil' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(saveNextStep).toHaveBeenCalledWith({ id: 'con_1', text: 'Créer votre profil' }));
  });

  it('« Publier dans son espace » publishes and says the Client is told', async () => {
    const publish = vi.fn(() => ({ publishedAt: new Date(), first: true }));
    renderDetail({ 'consultationAdmin.publish': publish }, AFTER);
    fireEvent.click(screen.getByRole('button', { name: 'Publier dans son espace' }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith({ id: 'con_1' }));
    expect(await screen.findByText(/Publiée : Aminata est prévenu/)).toBeInTheDocument();
  });
});

describe('Tableau de bord → Consultations, « Calendrier »', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(THURSDAY);
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  function renderCalendar(calendar = vi.fn(({ week }: { week: string }) => (week === '2026-11-23' ? WEEK : { week, consultations: [], meetings: [] }))) {
    const blocked = { ...SETTINGS, weeklyHours: [...SETTINGS.weeklyHours, { day: 5, start: '09:00', end: '12:00' }], blockedDates: ['2026-11-24'] };
    const { trpc, queryClient, wrap } = createTestTRPC({
      'consultationAdmin.list': () => LIST,
      'consultationAdmin.settings': () => blocked,
      'consultationAdmin.calendar': calendar,
    });
    queryClient.setQueryData(trpc.consultationAdmin.list.queryKey({ tab: 'upcoming' }), LIST);
    queryClient.setQueryData(trpc.consultationAdmin.settings.queryKey(), blocked);
    queryClient.setQueryData(trpc.consultationAdmin.calendar.queryKey({ week: '2026-11-23' }), WEEK);
    const view = render(withIntl(wrap(<ConsultationsDashboardView />)));
    fireEvent.click(screen.getByRole('radio', { name: 'Calendrier' }));
    return { ...view, calendar };
  }

  it('shows the week: Consultations open their page, other Réunions theirs, the blocked date says so', async () => {
    const { container } = renderCalendar();
    const week = within(await screen.findByRole('region', { name: /Semaine du/ }));
    expect(week.getByRole('link', { name: 'Grace Nkeng, 09:00 – 09:45, Gardé 9 min' })).toHaveAttribute('href', '/consultations/con_held');
    expect(week.getByRole('link', { name: /Richil Stanley Nouping Nouping, 11:00 – 11:45, Payée/ })).toHaveTextContent('Richil Stanley Nouping Nouping');
    expect(week.getByRole('link', { name: /Signature, 15:00 – 16:00, Réunion/ })).toHaveAttribute('href', '/reunions/meet_9');
    expect(within(week.getByRole('group', { name: 'mardi 24 novembre' })).getByText('Bloquée')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Passées' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('stanzy.consultations.view')).toBe('calendar');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sums up the Disponibilités above the week; « Modifier » opens them beside it', async () => {
    renderCalendar();
    const bar = within(await screen.findByRole('region', { name: 'Disponibilités' }));
    expect(bar.getByText('lun 9h–12h · 14h–16h')).toBeInTheDocument();
    expect(bar.getByText('Sans tarif')).toBeInTheDocument();
    fireEvent.click(bar.getByRole('button', { name: 'Modifier' }));
    const panel = within(await screen.findByRole('dialog', { name: 'Disponibilités' }));
    expect(panel.getByDisplayValue('09:00 – 12:00 · 14:00 – 16:00')).toBeInTheDocument();
    fireEvent.click(panel.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('in the side panel, says which day’s hours it cannot read, and saves nothing', async () => {
    renderCalendar();
    fireEvent.click(within(await screen.findByRole('region', { name: 'Disponibilités' })).getByRole('button', { name: 'Modifier' }));
    const panel = within(await screen.findByRole('dialog', { name: 'Disponibilités' }));
    fireEvent.change(panel.getByDisplayValue('09:00 – 12:00 · 14:00 – 16:00'), { target: { value: 'le matin' } });
    fireEvent.click(panel.getByRole('button', { name: 'Enregistrer' }));
    expect(panel.getByRole('alert')).toHaveTextContent('Une plage n’est pas lisible');
  });

  it('moves a week at a time, and back to this one', async () => {
    const { calendar } = renderCalendar();
    await screen.findByRole('region', { name: /Semaine du/ });
    fireEvent.click(screen.getAllByRole('button', { name: 'Semaine suivante' })[0]!);
    await waitFor(() => expect(calendar).toHaveBeenCalledWith({ week: '2026-11-30' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Aujourd’hui' })[0]!);
    expect(await screen.findAllByRole('link', { name: /Grace Nkeng/ })).not.toHaveLength(0);
  });

  it('on mobile, one day at a time: today first, then the day tapped', async () => {
    renderCalendar();
    const today = await screen.findByRole('tab', { name: 'jeudi 26 novembre' });
    expect(today).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'mardi 24 novembre' }));
    expect(screen.getByText('Date bloquée : personne ne peut réserver ce jour-là.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'vendredi 27 novembre' }));
    const day = within(screen.getByRole('region', { name: 'vendredi 27 novembre' }));
    expect(day.getByRole('link', { name: /Grace Nkeng/ })).toHaveTextContent('Grace Nkeng');
  });
});
