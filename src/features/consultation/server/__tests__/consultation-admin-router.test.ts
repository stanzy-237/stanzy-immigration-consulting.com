import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_AVAILABILITY } from '@/features/consultation/lib/availability';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/** Seam: what reaches the Client (the « Déplacée » e-mail, the bell), watched. */
const told = vi.hoisted(() => ({ emailParticipantsLater: vi.fn(), notifyLater: vi.fn() }));
vi.mock('@/features/meetings/server/meeting-notify', async (original) => ({
  ...(await original<typeof import('@/features/meetings/server/meeting-notify')>()),
  emailParticipantsLater: told.emailParticipantsLater,
}));
/** Seam: « Renvoyer la confirmation » builds the paid e-mail and sends it. */
const resend = vi.hoisted(() => ({ paidConfirmation: vi.fn(), send: vi.fn() }));
vi.mock('@/features/consultation/server/consultation-payments', async (original) => ({
  ...(await original<typeof import('@/features/consultation/server/consultation-payments')>()),
  paidConfirmation: resend.paidConfirmation,
}));
vi.mock('@/server/email/app-mailer', () => ({ appMailer: { send: resend.send } }));
vi.mock('@/features/notifications/server/notify', async (original) => ({
  ...(await original<typeof import('@/features/notifications/server/notify')>()),
  notifyLater: told.notifyLater,
}));

type Row = Record<string, unknown> & { id: string };

// Tuesday 24 November 2026, 09:00 in Douala (UTC+1). Defaults: weekdays 09:00–17:00, 45 min + 15, 24 h notice.
const NOW = new Date('2026-11-24T08:00:00Z');
const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`);

const aminata = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', status: 'LEAD', locale: 'fr' };

/**
 * Seam: the Tableau de bord's `consultationAdmin` through a server-side
 * caller, over in-memory Consultations, payments, Réunions and settings.
 */
function fakeDatabase({ consultations = [] as Row[], payments = [] as Row[], meetings = [] as Row[], settings = null as Row | null } = {}) {
  const notes: Row[] = [];
  const steps: Row[] = [];
  const store = { consultations, payments, meetings, settings, notes, steps };
  const byId = <T extends Row>(rows: T[], id: unknown) => rows.find((r) => r.id === id);
  const withRelations = (c: Row) => ({
    ...c,
    account: { ...aminata, _count: { dossiers: 0 } },
    paidBy: byId(payments, c.paidById) ? { ...byId(payments, c.paidById)!, promoCode: null } : null,
    meeting: byId(meetings, c.meetingId) ? { ...byId(meetings, c.meetingId)!, recordings: [] } : null,
    clientNotes: notes.filter((n) => n.consultationId === c.id),
    nextSteps: steps.filter((n) => n.consultationId === c.id).toSorted((a, b) => (a.position as number) - (b.position as number)),
  });
  const isUpcoming = (c: Row, where: { OR?: { status: string; startsAt?: { gt: Date }; heldUntil?: { gt: Date } }[] }) =>
    (where.OR ?? []).some(
      (w) =>
        c.status === w.status &&
        (!w.startsAt || (c.startsAt as Date) > w.startsAt.gt) &&
        (!w.heldUntil || (c.heldUntil as Date | null) !== null && (c.heldUntil as Date) > w.heldUntil.gt),
    );
  const db = {
    consultationSettings: {
      findUnique: async () => store.settings,
      upsert: async ({ create }: { create: Row }) => (store.settings = create),
    },
    consultation: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        let rows = consultations;
        const inWindow = (c: Row) => {
          const w = where.startsAt as { gte?: Date; lt?: Date } | undefined;
          return (!w?.gte || (c.startsAt as Date) >= w.gte) && (!w?.lt || (c.startsAt as Date) < w.lt);
        };
        if ((where.status as { in?: string[] })?.in) return rows.filter((c) => (where.status as { in: string[] }).in.includes(c.status as string) && inWindow(c)).map(withRelations);
        if (where.OR && !where.meetingId) rows = rows.filter((c) => isUpcoming(c, where as never));
        else if (where.status === 'PAID' && (where.startsAt as { lt?: Date })?.lt) rows = rows.filter((c) => c.status === 'PAID' && (c.startsAt as Date) < (where.startsAt as { lt: Date }).lt);
        else if (where.meetingId === null) rows = rows.filter((c) => c.meetingId === null && (c.status === 'PAID' || (c.heldUntil as Date) > NOW));
        return rows.map(withRelations);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = byId(consultations, where.id);
        return c ? withRelations(c) : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(consultations, where.id)!, data),
    },
    consultationPayment: {
      count: async () => payments.filter((p) => p.status === 'FAILED' && byId(consultations, p.consultationId)?.status !== 'PAID').length,
      findMany: async () =>
        payments.filter((p) => p.status === 'FAILED').map((p) => ({ ...p, consultation: { ...byId(consultations, p.consultationId)!, account: aminata } })),
    },
    meeting: {
      findMany: async ({ where }: { where: { id?: { not: string }; consultation?: { is: null }; startsAt?: { gte: Date; lt: Date } } }) =>
        meetings.filter(
          (m) =>
            m.id !== where.id?.not &&
            (!where.consultation || !consultations.some((c) => c.meetingId === m.id)) &&
            (!where.startsAt?.gte || ((m.startsAt as Date) >= where.startsAt.gte && (m.startsAt as Date) < where.startsAt.lt)),
        ),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(meetings, where.id)!, data),
    },
    consultationNote: {
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `note_${notes.length + 1}` };
        notes.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(notes, where.id)!, data),
      deleteMany: async ({ where }: { where: { id: string } }) => {
        notes.splice(notes.findIndex((n) => n.id === where.id), 1);
        return { count: 1 };
      },
    },
    consultationStep: {
      findFirst: async ({ where }: { where: { consultationId: string } }) => steps.filter((s) => s.consultationId === where.consultationId).at(-1) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `step_${steps.length + 1}` };
        steps.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(steps, where.id)!, data),
      deleteMany: async () => ({ count: 1 }),
    },
    $executeRaw: async () => 0,
    $transaction: async (work: (tx: unknown) => unknown) => work(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], store };
}

const consultant = () => sessionFor({ id: 'acc_stanzy', role: 'CONSULTANT' });
const callerFor = (db: TRPCContext['prisma'], session = consultant()) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).consultationAdmin;

const paid = (extra: Row = { id: 'con_1' }): Row => ({
  accountId: 'acc_1',
  status: 'PAID',
  startsAt: at('2026-11-26', '09:00'),
  durationMinutes: 45,
  heldUntil: null,
  meetingId: 'meet_1',
  paidById: 'pay_1',
  crsScore: 452,
  topics: ['eligibility'],
  itaReceived: false,
  situation: 'Infirmière, 31 ans.',
  phone: '+237677123456',
  country: 'CM',
  ...extra,
});
const meeting = (extra: Row = { id: 'meet_1' }): Row => ({
  subject: 'Consultation · Aminata Diallo',
  startsAt: at('2026-11-26', '09:00'),
  durationMinutes: 45,
  recording: true,
  dossierId: null,
  notes: null,
  remindedDayBefore: null,
  remindedSoon: null,
  endedAt: null,
  status: 'SCHEDULED',
  ...extra,
});
const payment = (extra: Row = { id: 'pay_1' }): Row => ({
  consultationId: 'con_1',
  status: 'SUCCESS',
  amount: 15_000,
  discount: 0,
  currency: 'XAF',
  settledCurrency: 'XAF',
  fee: '713.00',
  charged: '15713.00',
  network: 'mtn_cm',
  networkName: 'MTN Mobile Money',
  settledAt: NOW,
  invoiceNumber: 'STZ-2026-0001',
  failureCode: null,
  createdAt: NOW,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('consultationAdmin, Disponibilités', () => {
  it('gives the defaults and no price until the consultant sets them', async () => {
    const { db } = fakeDatabase();
    expect(await callerFor(db).settings()).toMatchObject({ durationMinutes: 45, price: null });
  });

  it('saves several ranges a day and the price; refuses overlapping ranges', async () => {
    const { db, store } = fakeDatabase();
    const settings = {
      ...DEFAULT_AVAILABILITY,
      weeklyHours: [
        { day: 1, start: '09:00', end: '12:00' },
        { day: 1, start: '14:00', end: '16:00' },
      ],
      blockedDates: ['2026-12-25', '2026-12-25'],
      price: 12_345,
    };
    await callerFor(db).saveSettings(settings);
    expect(store.settings).toMatchObject({ price: 12_345, blockedDates: ['2026-12-25'] });

    await expect(
      callerFor(db).saveSettings({ ...settings, weeklyHours: [{ day: 1, start: '09:00', end: '12:00' }, { day: 1, start: '11:00', end: '13:00' }] }),
    ).rejects.toThrow();
  });

  it('is the consultant’s only', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, sessionFor()).settings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('consultationAdmin, the list', () => {
  it('shows the paid and held ones to come, and counts the failed payments not paid since', async () => {
    const { db } = fakeDatabase({
      consultations: [
        paid(),
        paid({ id: 'con_held', status: 'HELD', heldUntil: new Date(NOW.getTime() + 9 * 60_000), meetingId: null, paidById: null }),
        paid({ id: 'con_retry', status: 'PAID', paidById: 'pay_ok', meetingId: 'meet_2', startsAt: at('2026-11-27', '09:00') }),
        paid({ id: 'con_lost', status: 'HELD', heldUntil: NOW, meetingId: null, paidById: null }),
      ],
      payments: [
        payment(),
        payment({ id: 'pay_ok', consultationId: 'con_retry' }),
        payment({ id: 'pay_f1', consultationId: 'con_retry', status: 'FAILED' }),
        payment({ id: 'pay_f2', consultationId: 'con_lost', status: 'FAILED', failureCode: 'no_route_available' }),
      ],
      meetings: [meeting(), meeting({ id: 'meet_2' })],
    });
    const upcoming = await callerFor(db).list({ tab: 'upcoming' });
    expect(upcoming.rows.map((r) => [r.id, r.status, r.network])).toEqual([
      ['con_1', 'PAID', 'MTN Mobile Money'],
      ['con_held', 'HELD', null],
      ['con_retry', 'PAID', 'MTN Mobile Money'],
    ]);
    expect(upcoming.counts).toEqual({ upcoming: 3, failed: 1 });

    const failed = await callerFor(db).list({ tab: 'failed' });
    expect(failed.failed.map((f) => [f.id, f.paidLater, f.refusedAtOnce, f.released])).toEqual([
      ['pay_f1', true, false, false],
      ['pay_f2', false, true, true],
    ]);
  });
});

describe('consultationAdmin, a Consultation', () => {
  it('shows what the Client prepared, the payment and the reminders, and keeps private notes', async () => {
    const { db, store } = fakeDatabase({ consultations: [paid()], payments: [payment()], meetings: [meeting()] });
    const detail = await callerFor(db).detail({ id: 'con_1' });
    expect(detail).toMatchObject({
      answers: { crsScore: 452, topics: ['eligibility'] },
      payment: { price: 15_000, charged: 15_713, networkName: 'MTN Mobile Money', invoiceNumber: 'STZ-2026-0001' },
      client: { name: 'Aminata Diallo', phone: '+237677123456' },
    });

    await callerFor(db).saveNotes({ id: 'con_1', notes: ' Comparer EE et PNP. ' });
    expect(store.meetings[0]!.notes).toBe('Comparer EE et PNP.');
  });

  it('moves to a free start the consultant picks: the Réunion follows, reminders reset, the Client is told', async () => {
    const { db, store } = fakeDatabase({
      consultations: [paid()],
      payments: [payment()],
      meetings: [meeting({ id: 'meet_1', remindedDayBefore: NOW })],
    });
    const options = await callerFor(db).moveOptions({ id: 'con_1' });
    const target = options.days[1]!.starts[0]!;

    await callerFor(db).move({ id: 'con_1', start: target });

    expect(store.consultations[0]!.startsAt).toEqual(new Date(target));
    expect(store.meetings[0]).toMatchObject({ startsAt: new Date(target), remindedDayBefore: null });
    expect(told.emailParticipantsLater).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ email: 'aminata@example.com' })], expect.objectContaining({ startsAt: new Date(target) }), 'moved', null);
    expect(told.notifyLater).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'MEETING_MOVED', recipients: ['acc_1'] }));
  });

  it('refuses a start that is taken', async () => {
    const { db } = fakeDatabase({
      consultations: [paid()],
      payments: [payment()],
      meetings: [meeting(), meeting({ id: 'meet_other', startsAt: at('2026-11-27', '09:00') })],
    });
    await expect(callerFor(db).move({ id: 'con_1', start: at('2026-11-27', '09:00').toISOString() })).rejects.toThrow('SLOT_TAKEN');
  });

  it('« Annuler ce créneau » moves it to the next free slot, never the same, and tells the Client why', async () => {
    const { db, store } = fakeDatabase({ consultations: [paid()], payments: [payment()], meetings: [meeting()] });
    const { next } = await callerFor(db).moveOptions({ id: 'con_1' });

    const result = await callerFor(db).cancelSlot({ id: 'con_1', reason: 'Un empêchement de dernière minute.' });

    expect(result.startsAt.toISOString()).toBe(next);
    expect(result.startsAt).not.toEqual(at('2026-11-26', '09:00'));
    expect(store.consultations[0]!.status).toBe('PAID');
    expect(told.emailParticipantsLater).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'moved', 'Un empêchement de dernière minute.');
  });

  it('cannot move one not paid, or already over', async () => {
    const { db } = fakeDatabase({
      consultations: [paid({ id: 'con_held', status: 'HELD', meetingId: null }), paid({ id: 'con_past', startsAt: at('2026-11-20', '09:00') })],
      meetings: [meeting()],
    });
    await expect(callerFor(db).moveOptions({ id: 'con_held' })).rejects.toThrow('CONSULTATION_NOT_MOVABLE');
    await expect(callerFor(db).cancelSlot({ id: 'con_past', reason: 'Trop tard.' })).rejects.toThrow('CONSULTATION_NOT_MOVABLE');
  });
});

describe('consultationAdmin, the calendar', () => {
  it('gives one week: paid Consultations, those still held, and the other Réunions, not a Consultation’s own', async () => {
    const { db } = fakeDatabase({
      consultations: [
        paid(),
        paid({ id: 'con_held', status: 'HELD', meetingId: null, paidById: null, startsAt: at('2026-11-27', '09:00'), heldUntil: new Date(NOW.getTime() + 9 * 60_000) }),
        paid({ id: 'con_gone', status: 'HELD', meetingId: null, paidById: null, startsAt: at('2026-11-27', '10:00'), heldUntil: new Date(NOW.getTime() - 60_000) }),
        paid({ id: 'con_next_week', meetingId: 'meet_3', startsAt: at('2026-12-01', '09:00') }),
      ],
      meetings: [meeting(), meeting({ id: 'meet_2', subject: 'Signature', startsAt: at('2026-11-26', '15:00') }), meeting({ id: 'meet_3', startsAt: at('2026-12-01', '09:00') })],
    });
    const week = await callerFor(db).calendar({ week: '2026-11-26' });
    expect(week.week).toBe('2026-11-23');
    expect(week.consultations.map((c) => c.id)).toEqual(['con_1', 'con_held']);
    expect(week.consultations[0]).toMatchObject({ name: 'Aminata Diallo', status: 'PAID' });
    expect(week.meetings.map((m) => m.id)).toEqual(['meet_2']);
  });

  it('refuses a day it cannot read, and a Client', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db).calendar({ week: '26/11/2026' })).rejects.toThrow();
    await expect(callerFor(db, sessionFor({ id: 'acc_1', role: 'MEMBER' })).calendar({ week: '2026-11-23' })).rejects.toThrow();
  });
});

describe('consultationAdmin, « Renvoyer la confirmation »', () => {
  it('sends the paid e-mail again, built as the Consultation stands now', async () => {
    const message = { to: 'aminata@example.com', subject: 'Consultation confirmée', html: '', text: '' };
    resend.paidConfirmation.mockResolvedValue(message);
    const { db } = fakeDatabase({ consultations: [paid()], payments: [payment()], meetings: [meeting()] });
    await expect(callerFor(db).resendConfirmation({ id: 'con_1' })).resolves.toEqual({ sent: true });
    expect(resend.paidConfirmation).toHaveBeenCalledWith(db, 'pay_1');
    expect(resend.send).toHaveBeenCalledWith(message);
  });

  it('refuses one that is not paid', async () => {
    const { db } = fakeDatabase({ consultations: [paid({ id: 'con_1', status: 'HELD', paidById: null })] });
    await expect(callerFor(db).resendConfirmation({ id: 'con_1' })).rejects.toThrow('CONSULTATION_NOT_MOVABLE');
    expect(resend.send).not.toHaveBeenCalled();
  });
});

describe('consultationAdmin, « 2 Après »', () => {
  const finished = () => ({ consultations: [paid({ id: 'con_1', startsAt: at('2026-11-23', '15:00') })], payments: [payment()], meetings: [meeting({ id: 'meet_1', startsAt: at('2026-11-23', '15:00') })] });

  it('writes notes for the Client at a moment of the video, and next steps in order', async () => {
    const { db, store } = fakeDatabase(finished());
    await callerFor(db).saveClientNote({ id: 'con_1', atSeconds: 160, text: 'Votre profil est admissible.' });
    await callerFor(db).saveNextStep({ id: 'con_1', text: 'Passer le test de langue' });
    await callerFor(db).saveNextStep({ id: 'con_1', text: 'Faire évaluer votre diplôme' });
    expect(store.notes).toEqual([expect.objectContaining({ consultationId: 'con_1', atSeconds: 160, text: 'Votre profil est admissible.' })]);
    expect(store.steps.map((s) => [s.text, s.position])).toEqual([
      ['Passer le test de langue', 0],
      ['Faire évaluer votre diplôme', 1],
    ]);
    const detail = await callerFor(db).detail({ id: 'con_1' });
    expect(detail).toMatchObject({ over: true, recording: null });
    expect(detail.publishedAt).toBeFalsy();
  });

  it('refuses before it is over', async () => {
    const { db } = fakeDatabase({ consultations: [paid()], payments: [payment()], meetings: [meeting()] });
    await expect(callerFor(db).saveClientNote({ id: 'con_1', atSeconds: null, text: 'Trop tôt' })).rejects.toThrow('CONSULTATION_NOT_OVER');
    await expect(callerFor(db).publish({ id: 'con_1' })).rejects.toThrow('CONSULTATION_NOT_OVER');
  });

  it('publishes once: « Votre enregistrement est prêt » with the next steps, then no e-mail again', async () => {
    const { db, store } = fakeDatabase(finished());
    await callerFor(db).saveNextStep({ id: 'con_1', text: 'Passer le test de langue' });
    await expect(callerFor(db).publish({ id: 'con_1' })).resolves.toMatchObject({ first: true });
    expect(store.consultations[0]!.publishedAt).toBeInstanceOf(Date);
    expect(resend.send).toHaveBeenCalledTimes(1);
    expect(resend.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'aminata@example.com', subject: 'Votre enregistrement est prêt', html: expect.stringContaining('Passer le test de langue') }));
    await expect(callerFor(db).publish({ id: 'con_1' })).resolves.toMatchObject({ first: false });
    expect(resend.send).toHaveBeenCalledTimes(1);
  });
});
