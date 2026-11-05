import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const stream = vi.hoisted(() => ({ streamConfigured: vi.fn(() => true), openRoom: vi.fn(), endRoom: vi.fn(async () => {}) }));
vi.mock('@/features/meetings/server/stream', () => stream);
const emails = vi.hoisted(() => ({ emailParticipantsLater: vi.fn() }));
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
 * for the account, dossier, meeting, participant, join request, consent and
 * recording tables. Stream and the emails are stubbed; the access rules,
 * the room's hours and the waiting room run for real.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_p', name: 'Paul Partenaire', email: 'paul@example.com', locale: 'fr', role: 'PARTNER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [{ id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' }];
  const meetings: Row[] = [];
  const participants: Row[] = [];
  const requests: Row[] = [];
  const consents: Row[] = [];
  const recordings: Row[] = [];
  let seq = 0;
  const account = (id: unknown) => accounts.find((a) => a.id === id)!;
  const dossierOf = (id: unknown) => {
    const dossier = dossiers.find((d) => d.id === id);
    return dossier ? { ...dossier, account: account(dossier.accountId) } : null;
  };
  type Select = Record<string, { where?: Row } | boolean | undefined>;
  const full = (meeting: Row, select: Select = {}) => {
    const where = (key: string): Record<string, unknown> => (select[key] as { where?: Row } | undefined)?.where ?? {};
    const matches = (row: Row, filter: Record<string, unknown>) => Object.entries(filter).every(([k, v]) => row[k] === v);
    return {
      ...meeting,
      dossier: dossierOf(meeting.dossierId),
      participants: participants
        .filter((p) => p.meetingId === meeting.id && matches(p, where('participants')))
        .map((p) => ({ ...p, account: account(p.accountId) })),
      joinRequests: requests.filter((r) => r.meetingId === meeting.id && matches(r, where('joinRequests'))),
      recordings: recordings.filter((r) => r.meetingId === meeting.id),
    };
  };

  const db = {
    account: {
      findMany: async ({ where }: { where: { role: string | { in: string[] }; id?: { in: string[] } } }) =>
        accounts.filter(
          (a) =>
            (typeof where.role === 'string' ? a.role === where.role : where.role.in.includes(a.role as string)) &&
            (!where.id || where.id.in.includes(a.id)),
        ),
    },
    dossier: {
      findUnique: async ({ where }: { where: { id: string } }) => dossierOf(where.id),
    },
    meeting: {
      findUnique: async ({ where, select }: { where: { id?: string; inviteToken?: string }; select?: Select }) => {
        const row = meetings.find((m) => (where.id ? m.id === where.id : m.inviteToken === where.inviteToken));
        return row ? full(row, select) : null;
      },
      findFirst: async ({ where }: { where: Row }) => {
        const row = meetings.find((m) => m.kind === where.kind && m.plannedById === where.plannedById);
        return row ? full(row) : null;
      },
      findMany: async ({ where }: { where: { dossierId?: string } }) =>
        meetings.filter((m) => (where.dossierId ? m.dossierId === where.dossierId : true)).map((m) => full(m)),
      create: async ({ data }: { data: Row & { participants?: { create: { accountId: string }[] } } }) => {
        const { participants: invited, ...rest } = data;
        const row: Row = {
          kind: 'SCHEDULED',
          status: 'SCHEDULED',
          description: null,
          notes: null,
          cancelReason: null,
          endedAt: null,
          remindedDayBefore: null,
          remindedSoon: null,
          dossierId: null,
          ...rest,
          id: `m_${++seq}`,
        };
        meetings.push(row);
        for (const { accountId } of invited?.create ?? []) participants.push({ id: `p_${++seq}`, meetingId: row.id, accountId });
        return full(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = meetings.find((m) => m.id === where.id)!;
        Object.assign(row, data);
        return full(row);
      },
      updateMany: async ({ where, data }: { where: Row & { kind?: { not: string } }; data: Row }) => {
        const row = meetings.find(
          (m) => m.id === where.id && m.status === where.status && (!where.kind || m.kind !== where.kind.not),
        );
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
    meetingParticipant: {
      findUnique: async ({ where }: { where: { meetingId_accountId: Row } }) =>
        participants.find(
          (p) => p.meetingId === where.meetingId_accountId.meetingId && p.accountId === where.meetingId_accountId.accountId,
        ) ?? null,
      deleteMany: async ({ where }: { where: { meetingId: string; accountId: { notIn: string[] } } }) => {
        for (let i = participants.length - 1; i >= 0; i--) {
          const p = participants[i]!;
          if (p.meetingId === where.meetingId && !where.accountId.notIn.includes(p.accountId as string)) participants.splice(i, 1);
        }
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) {
          if (!participants.some((p) => p.meetingId === row.meetingId && p.accountId === row.accountId)) {
            participants.push({ ...row, id: `p_${++seq}` });
          }
        }
      },
    },
    meetingJoinRequest: {
      findUnique: async ({ where }: { where: { id?: string; meetingId_accountId?: Row } }) =>
        requests.find((r) =>
          where.id
            ? r.id === where.id
            : r.meetingId === where.meetingId_accountId!.meetingId && r.accountId === where.meetingId_accountId!.accountId,
        ) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        requests
          .filter((r) => r.meetingId === where.meetingId && r.status === where.status)
          .map((r) => ({ ...r, account: account(r.accountId) })),
      create: async ({ data }: { data: Row }) => {
        requests.push({ ...data, id: `r_${++seq}`, status: 'PENDING', createdAt: new Date() });
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(requests.find((r) => r.id === where.id)!, data);
      },
    },
    meetingConsent: {
      findUnique: async ({ where }: { where: { meetingId_accountId: Row } }) =>
        consents.find(
          (c) => c.meetingId === where.meetingId_accountId.meetingId && c.accountId === where.meetingId_accountId.accountId,
        ) ?? null,
      create: async ({ data }: { data: Row }) => {
        consents.push({ ...data, id: `c_${++seq}`, acceptedAt: new Date() });
      },
    },
    meetingRecording: {
      findMany: async ({ where }: { where: { text?: { contains: string } } }) =>
        recordings
          .filter((r) => r.kind === 'TRANSCRIPTION' && String(r.text).toLowerCase().includes(where.text!.contains.toLowerCase()))
          .map((r) => ({ ...r, meeting: meetings.find((m) => m.id === r.meetingId) })),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], meetings, participants, requests, consents, recordings };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1' });
const partner = sessionFor({ id: 'acc_p', name: 'Paul Partenaire', role: 'PARTNER' });
const stranger = sessionFor({ id: 'acc_2', name: 'Bob Other' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext);

const plan = (extra: Record<string, unknown> = {}) => ({
  dossierId: 'dos_1' as string | null,
  subject: 'Point sur la preuve de fonds',
  description: null,
  participantIds: [] as string[],
  startsAt: new Date('2026-11-11T13:00:00Z'),
  durationMinutes: 30,
  recording: true,
  ...extra,
});

describe('planning a Réunion', () => {
  it('from a Dossier invites its Client, who is told by email and bell', async () => {
    const { db, meetings, participants } = fakeDatabase();
    const { id, inviteToken } = await callerFor(db, consultant).meetings.schedule(plan());
    expect(meetings[0]).toMatchObject({ id, kind: 'SCHEDULED', dossierId: 'dos_1', plannedById: 'acc_stanzy' });
    expect(inviteToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(participants.map((p) => p.accountId)).toEqual(['acc_1']);
    expect(emails.emailParticipantsLater).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ email: 'aminata@example.com' })],
      expect.objectContaining({ id }),
      'scheduled',
      undefined,
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, {
      kind: 'MEETING_SCHEDULED',
      actorId: 'acc_stanzy',
      recipients: ['acc_1'],
      target: { dossierId: 'dos_1' },
      params: { meetingId: id, subject: 'Point sur la preuve de fonds', startsAt: '2026-11-11T13:00:00.000Z' },
    });
  });

  it('on its own, with a partner; never with an unknown account or the consultant', async () => {
    const { db, participants } = fakeDatabase();
    const caller = callerFor(db, consultant);
    await caller.meetings.schedule(plan({ dossierId: null, participantIds: ['acc_p'] }));
    expect(participants.map((p) => p.accountId)).toEqual(['acc_p']);
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, expect.objectContaining({ target: {} }));
    await expect(caller.meetings.schedule(plan({ participantIds: ['acc_9'] }))).rejects.toMatchObject({
      message: 'MEETING_PARTICIPANT_UNKNOWN',
    });
    await expect(caller.meetings.schedule(plan({ participantIds: ['acc_stanzy'] }))).rejects.toMatchObject({
      message: 'MEETING_PARTICIPANT_UNKNOWN',
    });
  });

  it('refuses the past, and anyone but the consultant', async () => {
    const { db } = fakeDatabase();
    await expect(
      callerFor(db, consultant).meetings.schedule(plan({ startsAt: new Date('2026-11-10T08:00:00Z') })),
    ).rejects.toMatchObject({ message: 'MEETING_IN_PAST' });
    await expect(callerFor(db, client).meetings.schedule(plan())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tells everyone when it moves, and invites newcomers', async () => {
    const { db, meetings, participants } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const { id } = await caller.meetings.schedule(plan());
    meetings[0]!.remindedDayBefore = new Date();
    vi.clearAllMocks();

    await caller.meetings.update({ ...plan({ startsAt: new Date('2026-11-12T13:00:00Z'), participantIds: ['acc_p'] }), id });
    expect(meetings[0]).toMatchObject({ remindedDayBefore: null, remindedSoon: null });
    expect(participants.map((p) => p.accountId).sort()).toEqual(['acc_1', 'acc_p']);
    const sent = emails.emailParticipantsLater.mock.calls.map((call) => [call[1].map((p: { id: string }) => p.id), call[3]]);
    expect(sent).toEqual([
      [['acc_p'], 'scheduled'],
      [['acc_1'], 'moved'],
    ]);
  });

  it('cancels once, telling those invited', async () => {
    const { db, meetings } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const { id } = await caller.meetings.schedule(plan());
    await caller.meetings.cancel({ id, reason: 'Reportée' });
    expect(meetings[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'Reportée' });
    expect(emails.emailParticipantsLater).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.anything(), 'cancelled', 'Reportée');
    await expect(caller.meetings.cancel({ id, reason: '' })).rejects.toMatchObject({ message: 'MEETING_NOT_SCHEDULED' });
  });

  it('starts an instant Réunion now, telling those invited at once', async () => {
    const { db, meetings } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.instant({
      subject: '',
      dossierId: null,
      participantIds: ['acc_p'],
      recording: false,
    });
    expect(meetings[0]).toMatchObject({ id, kind: 'INSTANT', startsAt: new Date('2026-11-10T09:00:00Z'), durationMinutes: 60 });
    expect(emails.emailParticipantsLater).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ id: 'acc_p' })], expect.anything(), 'instant', undefined);
    expect((await callerFor(db, partner).meetings.room({ id })).joinable).toBe(true);
  });
});

describe('the room', () => {
  it('lets those invited in while it is open, once they accepted the recording', async () => {
    const { db, consents } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan({ startsAt: new Date('2026-11-10T09:10:00Z') }));
    const caller = callerFor(db, client);
    await expect(caller.meetings.join({ id, accepted: false })).rejects.toMatchObject({ message: 'MEETING_CONSENT_REQUIRED' });
    expect(await caller.meetings.join({ id, accepted: true })).toEqual({
      apiKey: 'key',
      token: 'token',
      callId: 'meeting_m',
      user: { id: 'acc_1', name: 'Aminata Diallo' },
    });
    expect(consents).toHaveLength(1);
    await expect(callerFor(db, stranger).meetings.join({ id, accepted: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('stays shut before it opens, and without Stream', async () => {
    const { db } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan());
    await expect(callerFor(db, client).meetings.join({ id, accepted: true })).rejects.toMatchObject({ message: 'MEETING_NOT_OPEN' });
    vi.setSystemTime(new Date('2026-11-11T12:50:00Z'));
    stream.streamConfigured.mockReturnValue(false);
    await expect(callerFor(db, client).meetings.join({ id, accepted: true })).rejects.toMatchObject({
      message: 'MEETINGS_UNCONFIGURED',
    });
  });

  it('ends for everyone: the Réunion is then over', async () => {
    const { db, meetings } = fakeDatabase();
    const { id } = await callerFor(db, consultant).meetings.schedule(plan({ startsAt: new Date('2026-11-10T09:10:00Z') }));
    await callerFor(db, consultant).meetings.end({ id });
    expect(stream.endRoom).toHaveBeenCalledWith(id);
    expect(meetings[0]!.endedAt).toEqual(expect.any(Date));
    expect(await callerFor(db, client).meetings.room({ id })).toMatchObject({ past: true, joinable: false });
    await expect(callerFor(db, client).meetings.end({ id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('the invitation link', () => {
  it('lets someone not invited ask; the consultant lets them in, and they join', async () => {
    const { db, requests, participants } = fakeDatabase();
    const { id, inviteToken } = await callerFor(db, consultant).meetings.instant({
      subject: 'Point rapide',
      dossierId: null,
      participantIds: [],
      recording: false,
    });
    const caller = callerFor(db, stranger);
    expect(await caller.meetings.invitation.get({ token: inviteToken })).toMatchObject({ id, viewer: 'NONE' });
    await expect(caller.meetings.room({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(await caller.meetings.invitation.request({ token: inviteToken })).toEqual({ status: 'PENDING' });
    expect(notifications.notifyLater).toHaveBeenLastCalledWith(
      db,
      expect.objectContaining({ kind: 'MEETING_JOIN_REQUEST', recipients: 'CONSULTANTS', params: expect.objectContaining({ meetingId: id }) }),
    );
    const waiting = await callerFor(db, consultant).meetings.invitation.waiting({ id });
    expect(waiting).toEqual([expect.objectContaining({ account: expect.objectContaining({ name: 'Bob Other' }) })]);

    await callerFor(db, consultant).meetings.invitation.decide({ id: waiting[0]!.id, admit: true });
    expect(requests[0]).toMatchObject({ status: 'ADMITTED' });
    expect(participants.map((p) => p.accountId)).toEqual(['acc_2']);
    expect(await caller.meetings.invitation.get({ token: inviteToken })).toMatchObject({ viewer: 'invited' });
    await expect(caller.meetings.join({ id, accepted: false })).resolves.toMatchObject({ callId: 'meeting_m' });
  });

  it('keeps a refused request refused', async () => {
    const { db } = fakeDatabase();
    const { id, inviteToken } = await callerFor(db, consultant).meetings.instant({
      subject: '',
      dossierId: null,
      participantIds: [],
      recording: false,
    });
    await callerFor(db, stranger).meetings.invitation.request({ token: inviteToken });
    const [request] = await callerFor(db, consultant).meetings.invitation.waiting({ id });
    await callerFor(db, consultant).meetings.invitation.decide({ id: request!.id, admit: false });
    expect(await callerFor(db, stranger).meetings.invitation.request({ token: inviteToken })).toEqual({ status: 'REFUSED' });
    await expect(callerFor(db, consultant).meetings.invitation.decide({ id: request!.id, admit: true })).rejects.toMatchObject({
      message: 'MEETING_REQUEST_DECIDED',
    });
  });
});

describe('the Salle personnelle', () => {
  it('is made once, always open, and gets a new link on demand', async () => {
    const { db, meetings } = fakeDatabase();
    const caller = callerFor(db, consultant);
    const room = await caller.meetings.dashboard.personalRoom();
    expect(room).toMatchObject({ kind: 'PERSONAL', subject: 'Salle personnelle · Stanzy' });
    expect((await caller.meetings.dashboard.personalRoom()).id).toBe(room.id);
    expect(meetings).toHaveLength(1);
    expect((await caller.meetings.room({ id: room.id })).joinable).toBe(true);
  });
});

describe('what the consultant alone sees', () => {
  it('keeps the link, notes and recordings from the Client, and searches what was said', async () => {
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
    expect(mine.meetings[0]).toMatchObject({ notes: 'Relancer pour le relevé.', inviteToken: expect.any(String) });
    const theirs = await callerFor(db, client).meetings.forDossier({ dossierId: 'dos_1' });
    expect(theirs.meetings[0]).toMatchObject({ notes: null, inviteToken: null, recordings: [] });
    expect(await caller.meetings.search({ dossierId: 'dos_1', query: 'preuve' })).toEqual([
      { id: 'r_1', meeting: expect.objectContaining({ id }), lines: ['Stanzy : La preuve de fonds doit couvrir 6 mois.'] },
    ]);
  });
});
