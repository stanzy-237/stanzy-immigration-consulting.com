import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/** Seam: what a move tells (the « Déplacée » e-mail, the bell), watched. */
const told = vi.hoisted(() => ({ emailParticipantsLater: vi.fn(), notifyLater: vi.fn() }));
vi.mock('@/features/meetings/server/meeting-notify', async (original) => ({
  ...(await original<typeof import('@/features/meetings/server/meeting-notify')>()),
  emailParticipantsLater: told.emailParticipantsLater,
}));
vi.mock('@/features/notifications/server/notify', async (original) => ({
  ...(await original<typeof import('@/features/notifications/server/notify')>()),
  notifyLater: told.notifyLater,
}));

type Row = Record<string, unknown> & { id: string };

// Tuesday 24 November 2026, 09:00 in Douala (UTC+1). Defaults: weekdays 09:00–17:00, 45 min + 15, 24 h notice, move until 24 h before.
const NOW = new Date('2026-11-24T08:00:00Z');
const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`);

const paid = (extra: Row = { id: 'con_1' }): Row => ({
  accountId: 'acc_1',
  status: 'PAID',
  startsAt: at('2026-11-27', '09:00'),
  durationMinutes: 45,
  heldUntil: null,
  meetingId: 'meet_1',
  paidById: 'pay_1',
  publishedAt: null,
  topics: ['eligibility'],
  crsScore: 452,
  itaReceived: false,
  situation: null,
  ...extra,
});

/** Seam: the Client's `consultationSpace` through a server-side caller, over in-memory rows. */
function fakeDatabase({ consultations = [] as Row[], steps = [] as Row[], notes = [] as Row[] } = {}) {
  const meetings: Row[] = consultations.map((c) => ({ id: c.meetingId as string, subject: 'Consultation', recording: true, dossierId: null, endedAt: null, recordings: [] }));
  const byId = <T extends Row>(rows: T[], id: unknown) => rows.find((r) => r.id === id);
  const full = (c: Row) => ({
    ...c,
    account: { id: c.accountId, name: 'Aminata Diallo', email: 'aminata@example.com', status: 'LEAD', locale: 'fr' },
    paidBy: { id: 'pay_1', amount: 15_000, charged: '15713.00', currency: 'XAF', settledCurrency: 'XAF', networkName: 'MTN Mobile Money', invoiceNumber: 'STZ-2026-0001', promoCode: null },
    meeting: byId(meetings, c.meetingId) ?? null,
    clientNotes: notes.filter((n) => n.consultationId === c.id),
    nextSteps: steps.filter((s) => s.consultationId === c.id),
    payments: [],
  });
  const db = {
    consultationSettings: { findUnique: async () => null },
    consultation: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = byId(consultations, where.id);
        return c ? full(c) : null;
      },
      findMany: async ({ where }: { where: { accountId?: string; startsAt?: unknown } }) =>
        consultations.filter((c) => !where.accountId || c.accountId === where.accountId).map(full),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(consultations, where.id)!, data),
    },
    meeting: {
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(byId(meetings, where.id)!, data),
    },
    consultationStep: {
      updateMany: async ({ where, data }: { where: { id: string; consultationId: string }; data: Row }) => {
        const step = steps.find((s) => s.id === where.id && s.consultationId === where.consultationId);
        if (step) Object.assign(step, data);
        return { count: step ? 1 : 0 };
      },
    },
    account: { findFirst: async () => ({ id: 'acc_stanzy' }) },
    $executeRaw: async () => 0,
    $transaction: async (work: (tx: unknown) => unknown) => work(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], consultations, steps };
}

const callerFor = (db: TRPCContext['prisma'], account = 'acc_1') =>
  createCaller({ prisma: db, session: sessionFor({ id: account }), headers: new Headers() } as unknown as TRPCContext).consultationSpace;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('consultationSpace, Mon espace', () => {
  it('lists my Consultations, to come and past, and shows no one else’s', async () => {
    const { db } = fakeDatabase({ consultations: [paid(), paid({ id: 'con_old', startsAt: at('2026-11-20', '09:00'), publishedAt: NOW, meetingId: 'meet_2' })] });
    const mine = await callerFor(db).list();
    expect(mine.upcoming.map((c) => c.id)).toEqual(['con_1']);
    expect(mine.past).toEqual([expect.objectContaining({ id: 'con_old', published: true })]);
    await expect(callerFor(db, 'acc_other').detail({ id: 'con_1' })).rejects.toThrow('NOT_FOUND');
  });

  it('shows nothing written after the Consultation until it is published, then the notes and steps', async () => {
    const steps = [{ id: 'step_1', consultationId: 'con_old', text: 'Passer le test de langue', doneAt: null, position: 0 }];
    const notes = [{ id: 'note_1', consultationId: 'con_old', atSeconds: 160, text: 'Votre profil est admissible.' }];
    const { db, consultations } = fakeDatabase({ consultations: [paid({ id: 'con_old', startsAt: at('2026-11-20', '09:00') })], steps, notes });
    expect((await callerFor(db).detail({ id: 'con_old' })).published).toBeNull();
    consultations[0]!.publishedAt = NOW;
    const detail = await callerFor(db).detail({ id: 'con_old' });
    expect(detail.published).toMatchObject({ notes: [{ atSeconds: 160, text: 'Votre profil est admissible.' }], steps: [{ id: 'step_1', doneAt: null }] });
    await callerFor(db).toggleStep({ id: 'con_old', stepId: 'step_1', done: true });
    expect(steps[0]!.doneAt).toBeInstanceOf(Date);
  });

  it('moving closes 24 h before the start', async () => {
    const { db } = fakeDatabase({ consultations: [paid({ id: 'con_1', startsAt: at('2026-11-25', '08:30') })] });
    const detail = await callerFor(db).detail({ id: 'con_1' });
    expect(detail.canMove).toBe(false);
    await expect(callerFor(db).move({ id: 'con_1', start: at('2026-11-27', '10:00').toISOString() })).rejects.toThrow('MOVE_CLOSED');
  });

  it('moves to a free start: the Réunion follows, the Client gets « Déplacée », Stanzy the bell', async () => {
    const { db, consultations } = fakeDatabase({ consultations: [paid()] });
    const { days } = await callerFor(db).moveOptions({ id: 'con_1' });
    const start = days[1]!.starts[0]!;
    await callerFor(db).move({ id: 'con_1', start });
    expect(consultations[0]!.startsAt).toEqual(new Date(start));
    expect(told.emailParticipantsLater).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ email: 'aminata@example.com' })], expect.anything(), 'moved', null);
    expect(told.notifyLater).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recipients: ['acc_stanzy'] }));
  });
});
