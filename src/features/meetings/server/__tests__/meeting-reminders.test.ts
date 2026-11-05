import { beforeEach, describe, expect, it, vi } from 'vitest';

import { remindMeetings } from '@/features/meetings/server/meeting-reminders';
import type { TRPCContext } from '@/server/trpc/context';

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);

beforeEach(() => vi.clearAllMocks());

type Row = Record<string, unknown> & { id: string };

/** Seam: the reminder round over an in-memory meeting table, the clock and the mailer passed in. */
function fakeDatabase(meetings: Row[]) {
  const client = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' };
  const db = {
    meeting: {
      findMany: async () =>
        meetings
          .filter((m) => m.status === 'SCHEDULED' && !m.remindedSoon)
          .map((m) => ({ ...m, participants: [{ account: client }] })),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
        const field = 'remindedSoon' in where ? 'remindedSoon' : 'remindedDayBefore';
        const row = meetings.find((m) => m.id === where.id && !m[field]);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
  };
  return db as unknown as TRPCContext['prisma'];
}

const meeting = (extra: Record<string, unknown> = {}): Row => ({
  id: 'm_1',
  dossierId: 'dos_1',
  subject: 'Point',
  startsAt: new Date('2026-11-11T13:00:00Z'),
  durationMinutes: 30,
  recording: true,
  status: 'SCHEDULED',
  createdAt: new Date('2026-11-01T09:00:00Z'),
  remindedDayBefore: null,
  remindedSoon: null,
  ...extra,
});
const run = (db: TRPCContext['prisma'], now: string, mailer = { send: vi.fn() }) =>
  remindMeetings({ db, mailer, siteUrl: 'https://stanzy.test', now: new Date(now) });

describe('Réunion reminders', () => {
  it('reminds the Client the day before, once', async () => {
    const rows = [meeting()];
    const db = fakeDatabase(rows);
    const mailer = { send: vi.fn() };
    expect(await run(db, '2026-11-10T13:05:00Z', mailer)).toEqual({ dayBefore: 1, soon: 0 });
    expect(notifications.notify).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: 'MEETING_REMINDER', recipients: ['acc_1'], params: expect.objectContaining({ soon: 'false' }) }),
      expect.any(Date),
    );
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Demain : Point' }));
    expect(await run(db, '2026-11-10T13:10:00Z')).toEqual({ dayBefore: 0, soon: 0 });
  });

  it('skips the day before for a Réunion planned less than a day ahead', async () => {
    const db = fakeDatabase([meeting({ createdAt: new Date('2026-11-11T08:00:00Z') })]);
    expect(await run(db, '2026-11-11T09:00:00Z')).toEqual({ dayBefore: 0, soon: 0 });
  });

  it('reminds both sides 15 minutes before, once, a late run included', async () => {
    const rows = [meeting({ remindedDayBefore: new Date('2026-11-10T13:05:00Z') })];
    const db = fakeDatabase(rows);
    const mailer = { send: vi.fn() };
    expect(await run(db, '2026-11-11T12:52:00Z', mailer)).toEqual({ dayBefore: 0, soon: 1 });
    expect(notifications.notify).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ recipients: 'CONSULTANTS', params: expect.objectContaining({ soon: 'true' }) }),
      expect.any(Date),
    );
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Dans 15 minutes : Point' }));
    expect(await run(db, '2026-11-11T12:57:00Z')).toEqual({ dayBefore: 0, soon: 0 });
  });

  it('says nothing once the Réunion is over', async () => {
    const db = fakeDatabase([meeting()]);
    expect(await run(db, '2026-11-11T14:00:00Z')).toEqual({ dayBefore: 0, soon: 0 });
  });
});
