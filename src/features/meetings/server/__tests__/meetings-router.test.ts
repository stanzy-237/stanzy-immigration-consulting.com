import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const stream = vi.hoisted(() => ({ streamConfigured: vi.fn(() => true), openRoom: vi.fn() }));
vi.mock('@/features/meetings/server/stream', () => stream);
const emails = vi.hoisted(() => ({ emailClientLater: vi.fn() }));
vi.mock('@/features/meetings/server/meeting-notify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/meetings/server/meeting-notify')>()),
  ...emails,
}));
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date('2026-11-10T09:00:00Z'), toFake: ['Date'] });
  stream.streamConfigured.mockReturnValue(true);
  stream.openRoom.mockResolvedValue({ apiKey: 'key', token: 'token', callId: 'meeting_m' });
});

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `meetings` through a server-side caller, over an in-memory stand-in
 * for the dossier, meeting, consent and recording tables. Stream and the
 * emails are stubbed; the access rules and the room's hours run for real.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [{ id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' }];
  const meetings: Row[] = [];
  const consents: Row[] = [];
  const recordings: Row[] = [];
  let seq = 0;
  const withFiles = (meeting: Row) => ({ ...meeting, recordings: recordings.filter((r) => r.meetingId === meeting.id) });

  const db = {
    dossier: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const dossier = dossiers.find((d) => d.id === where.id);
        return dossier ? { ...dossier, account: accounts.find((a) => a.id === dossier.accountId) } : null;
      },
    },
    account: {
      findMany: async ({ where }: { where: { role: string } }) => accounts.filter((a) => a.role === where.role),
    },
    meeting: {
      findUnique: async ({ where }: { where: { id: string } }) => meetings.find((m) => m.id === where.id) ?? null,
      findMany: async ({ where }: { where: { dossierId: string } }) =>
        meetings.filter((m) => m.dossierId === where.dossierId).map(withFiles),
      create: async ({ data }: { data: Row }) => {
        const row = {
          status: 'SCHEDULED',
          notes: null,
          cancelReason: null,
          remindedDayBefore: null,
          remindedSoon: null,
          ...data,
          id: `m_${++seq}`,
        };
        meetings.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = meetings.find((m) => m.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const row = meetings.find((m) => m.id === where.id && m.status === where.status);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
    meetingConsent: {
      findUnique: async ({ where }: { where: { meetingId_accountId: { meetingId: string; accountId: string } } }) =>
        consents.find(
          (c) => c.meetingId === where.meetingId_accountId.meetingId && c.accountId === where.meetingId_accountId.accountId,
        ) ?? null,
      create: async ({ data }: { data: Row }) => {
        consents.push({ ...data, id: `c_${++seq}`, acceptedAt: new Date() });
      },
    },
    meetingRecording: {
      findMany: async ({ where }: { where: { text: { contains: string } } }) =>
        recordings
          .filter((r) => r.kind === 'TRANSCRIPTION' && String(r.text).toLowerCase().includes(where.text.contains.toLowerCase()))
          .map((r) => ({ ...r, meeting: meetings.find((m) => m.id === r.meetingId) })),
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], meetings, consents, recordings };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1' });
const stranger = sessionFor({ id: 'acc_2', name: 'Bob Other' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext);

const plan = (extra: Record<string, unknown> = {}) => ({
  dossierId: 'dos_1',
  subject: 'Point sur la preuve de fonds',
  startsAt: new Date('2026-11-11T13:00:00Z'),
  durationMinutes: 30,
  recording: true,
  ...extra,
});

describe('Réunions', () => {
  it('lets the consultant plan one, and tells the Client by email and bell', async () => {
    const { db, meetings } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan());
    expect(meetings[0]).toMatchObject({ id, status: 'SCHEDULED', plannedById: 'acc_stanzy', recording: true });
    expect(emails.emailClientLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'aminata@example.com' }),
      expect.objectContaining({ id, subject: 'Point sur la preuve de fonds' }),
      'scheduled',
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, {
      kind: 'MEETING_SCHEDULED',
      actorId: 'acc_stanzy',
      recipients: ['acc_1'],
      target: { dossierId: 'dos_1' },
      params: { meetingId: id, subject: 'Point sur la preuve de fonds', startsAt: '2026-11-11T13:00:00.000Z' },
    });
  });

  it('refuses a Réunion in the past, and the Client planning one', async () => {
    const { db } = fakeDatabase();
    await expect(
      callerFor(db, consultant).meetings.schedule(plan({ startsAt: new Date('2026-11-10T08:00:00Z') })),
    ).rejects.toMatchObject({ message: 'MEETING_IN_PAST' });
    await expect(callerFor(db, client).meetings.schedule(plan())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tells the Client again when it moves, and resets its reminders', async () => {
    const { db, meetings } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const { id } = await caller.meetings.schedule(plan());
    meetings[0]!.remindedDayBefore = new Date();
    vi.clearAllMocks();

    await caller.meetings.update({ id, subject: 'Point', startsAt: new Date('2026-11-11T13:00:00Z'), durationMinutes: 30, recording: false });
    expect(emails.emailClientLater).not.toHaveBeenCalled();
    expect(meetings[0]).toMatchObject({ subject: 'Point', recording: false });

    await caller.meetings.update({ id, subject: 'Point', startsAt: new Date('2026-11-12T13:00:00Z'), durationMinutes: 45, recording: false });
    expect(meetings[0]).toMatchObject({ remindedDayBefore: null, remindedSoon: null, durationMinutes: 45 });
    expect(emails.emailClientLater).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'moved');
  });

  it('cancels with a reason, once', async () => {
    const { db, meetings } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const { id } = await caller.meetings.schedule(plan());
    await caller.meetings.cancel({ id, reason: 'Reportée' });
    expect(meetings[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'Reportée' });
    expect(emails.emailClientLater).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'cancelled',
      'Reportée',
    );
    await expect(caller.meetings.cancel({ id, reason: '' })).rejects.toMatchObject({ message: 'MEETING_NOT_SCHEDULED' });
  });

  it('lets the Client in only while the room is open, once they accepted the recording', async () => {
    const { db, consents } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan({ startsAt: new Date('2026-11-10T09:10:00Z') }));
    const caller = callerFor(db, client);

    await expect(caller.meetings.join({ id, accepted: false })).rejects.toMatchObject({
      message: 'MEETING_CONSENT_REQUIRED',
    });
    const room = await caller.meetings.join({ id, accepted: true });
    expect(room).toEqual({ apiKey: 'key', token: 'token', callId: 'meeting_m', user: { id: 'acc_1', name: 'Aminata Diallo' } });
    expect(consents).toEqual([expect.objectContaining({ meetingId: id, accountId: 'acc_1' })]);
    expect(stream.openRoom).toHaveBeenCalledWith({
      meeting: expect.objectContaining({ id, recording: true }),
      people: [
        { id: 'acc_1', name: 'Aminata Diallo', consultant: false },
        expect.objectContaining({ id: 'acc_stanzy', name: 'Stanzy', consultant: true }),
      ],
      viewer: { id: 'acc_1', name: 'Aminata Diallo', consultant: false },
      language: 'fr',
    });
    // Accepted once: not asked again.
    await caller.meetings.join({ id, accepted: false });
    expect(consents).toHaveLength(1);
    expect((await caller.meetings.room({ id })).consentedAt).toEqual(expect.any(Date));

    await expect(callerFor(db, stranger).meetings.join({ id, accepted: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('keeps the room shut before it opens, and without Stream', async () => {
    const { db } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan());
    await expect(callerFor(db, client).meetings.join({ id, accepted: true })).rejects.toMatchObject({
      message: 'MEETING_NOT_OPEN',
    });
    expect((await callerFor(db, client).meetings.room({ id })).joinable).toBe(false);

    vi.setSystemTime(new Date('2026-11-11T12:50:00Z'));
    stream.streamConfigured.mockReturnValue(false);
    await expect(callerFor(db, client).meetings.join({ id, accepted: true })).rejects.toMatchObject({
      message: 'MEETINGS_UNCONFIGURED',
    });
  });

  it('shows the notes, Enregistrements and Transcriptions to the consultant only, and searches them', async () => {
    const { db, recordings } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const { id } = await caller.meetings.schedule(plan());
    await caller.meetings.saveNotes({ id, notes: 'Relancer pour le relevé.' });
    recordings.push({
      id: 'r_1',
      meetingId: id,
      kind: 'TRANSCRIPTION',
      startedAt: new Date(),
      endedAt: new Date(),
      text: 'Aminata Diallo : Bonjour\nStanzy : La preuve de fonds doit couvrir 6 mois.',
    });

    const mine = await caller.meetings.forDossier({ dossierId: 'dos_1' });
    expect(mine.meetings[0]).toMatchObject({ notes: 'Relancer pour le relevé.', recordings: [expect.objectContaining({ id: 'r_1' })] });
    const theirs = await callerFor(db, client).meetings.forDossier({ dossierId: 'dos_1' });
    expect(theirs.meetings[0]).toMatchObject({ notes: null, recordings: [] });

    expect(await caller.meetings.search({ dossierId: 'dos_1', query: 'preuve' })).toEqual([
      { id: 'r_1', meeting: expect.objectContaining({ id }), lines: ['Stanzy : La preuve de fonds doit couvrir 6 mois.'] },
    ]);
    await expect(callerFor(db, client).meetings.search({ dossierId: 'dos_1', query: 'preuve' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
