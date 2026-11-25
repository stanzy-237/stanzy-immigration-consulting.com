import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

type Row = Record<string, unknown>;

/**
 * Seam: `consultation` through a server-side caller, over an in-memory
 * stand-in for the settings and Réunion tables. The free-slot rules run for real.
 */
function fakeDatabase(settings: Row | null, meetings: Row[]) {
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, condition]) => {
      const value = row[key];
      if (condition === null) return value === null || value === undefined;
      if (typeof condition !== 'object' || condition instanceof Date) return value === condition;
      const c = condition as { in?: unknown[]; notIn?: unknown[]; lt?: Date; gt?: Date };
      if (c.in && !c.in.includes(value)) return false;
      if (c.notIn?.includes(value)) return false;
      if (c.lt && !((value as Date) < c.lt)) return false;
      if (c.gt && !((value as Date) > c.gt)) return false;
      return true;
    });
  return {
    consultationSettings: { findUnique: vi.fn(async () => settings) },
    meeting: { findMany: vi.fn(async ({ where }: { where: Row }) => meetings.filter((m) => matches(m, where))) },
  };
}

const caller = (db: ReturnType<typeof fakeDatabase>) =>
  createCaller({ prisma: db, session: null, headers: new Headers() } as unknown as TRPCContext);

const meeting = (startsAt: string, extra: Row = {}): Row => ({
  startsAt: new Date(startsAt),
  durationMinutes: 45,
  status: 'SCHEDULED',
  kind: 'SCHEDULED',
  endedAt: null,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Monday 23 November 2026, 08:00 in Douala.
  vi.setSystemTime(new Date('2026-11-23T07:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('consultation.slots', () => {
  it('offers weekdays 09:00–17:00 Douala, 45 minutes, a day ahead, until the consultant sets the Disponibilités', async () => {
    const { durationMinutes, price, days } = await caller(fakeDatabase(null, [])).consultation.slots();
    expect(durationMinutes).toBe(45);
    expect(price).toBeNull();
    // Monday is wholly inside the 24-hour notice: Tuesday is the first day offered.
    expect(days[0]).toEqual({
      day: '2026-11-24',
      starts: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map(
        (time) => new Date(`2026-11-24T${time}:00+01:00`).toISOString(),
      ),
    });
    expect(days.map((d) => d.day)).not.toContain('2026-11-28'); // Saturday
  });

  it('uses the consultant’s Disponibilités and price', async () => {
    const settings = {
      price: 12_345,
      durationMinutes: 60,
      bufferMinutes: 0,
      minNoticeHours: 0,
      horizonDays: 2,
      moveCutoffHours: 48,
      weeklyHours: [{ day: 1, start: '14:00', end: '16:00' }],
      blockedDates: [],
    };
    const { durationMinutes, price, days } = await caller(fakeDatabase(settings, [])).consultation.slots();
    expect({ durationMinutes, price }).toEqual({ durationMinutes: 60, price: 12_345 });
    expect(days).toEqual([
      { day: '2026-11-23', starts: ['2026-11-23T13:00:00.000Z', '2026-11-23T14:00:00.000Z'] },
    ]);
  });

  it('keeps the time of planned Réunions, not of cancelled or ended ones nor the Salle personnelle', async () => {
    const db = fakeDatabase(null, [
      meeting('2026-11-24T09:00:00Z'), // Tuesday 10:00 Douala
      meeting('2026-11-24T11:00:00Z', { status: 'CANCELLED' }),
      meeting('2026-11-24T13:00:00Z', { kind: 'PERSONAL' }),
      meeting('2026-11-24T14:00:00Z', { endedAt: new Date('2026-11-24T14:30:00Z') }),
    ]);
    const { days } = await caller(db).consultation.slots();
    const tuesday = days[0]!.starts.map((iso) => new Date(iso).getUTCHours() + 1);
    expect(tuesday).toEqual([9, 11, 12, 13, 14, 15, 16]);
  });
});
