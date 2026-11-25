import { describe, expect, it } from 'vitest';

import { freeSlots, type Availability } from '@/features/consultation/lib/slots';

/** Tuesday 24 November 2026, 07:00 in Douala (UTC+1). */
const NOW = new Date('2026-11-24T06:00:00Z');

const availability: Availability = {
  durationMinutes: 45,
  bufferMinutes: 15,
  minNoticeHours: 0,
  horizonDays: 1,
  // Wednesday only, 09:00–11:00 Douala.
  weeklyHours: [{ day: 3, start: '09:00', end: '11:00' }],
  blockedDates: [],
};

describe('freeSlots', () => {
  it('cuts each open window into the Consultation length plus the pause, in Douala time', () => {
    expect(freeSlots(availability, [], NOW)).toEqual([
      { day: '2026-11-25', starts: ['2026-11-25T08:00:00.000Z', '2026-11-25T09:00:00.000Z'] },
    ]);
  });
});

describe('freeSlots, what is not offered', () => {
  const week: Availability = {
    ...availability,
    horizonDays: 7,
    weeklyHours: [
      { day: 2, start: '09:00', end: '11:00' },
      { day: 3, start: '09:00', end: '11:00' },
      { day: 4, start: '09:00', end: '11:00' },
    ],
  };

  it('keeps starts sooner than the notice out', () => {
    // 07:00 Douala + 2 h 30 notice: Tuesday 09:00 is too soon, 10:00 is not.
    const days = freeSlots({ ...week, horizonDays: 0, minNoticeHours: 2.5 }, [], NOW);
    expect(days).toEqual([{ day: '2026-11-24', starts: ['2026-11-24T09:00:00.000Z'] }]);
  });

  it('offers nothing past the horizon and skips days with no open hours', () => {
    const days = freeSlots({ ...week, horizonDays: 3 }, [], NOW);
    // Tue 24 → Fri 27: Friday has no hours.
    expect(days.map((d) => d.day)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
  });

  it('skips a blocked date', () => {
    const days = freeSlots({ ...week, horizonDays: 3, blockedDates: ['2026-11-25'] }, [], NOW);
    expect(days.map((d) => d.day)).toEqual(['2026-11-24', '2026-11-26']);
  });

  it('keeps the pause free around a Réunion, and shows a full day with no starts', () => {
    const busy = [
      // Wednesday 09:50–10:20 Douala: touches the pause of both slots.
      { startsAt: new Date('2026-11-25T08:50:00Z'), endsAt: new Date('2026-11-25T09:20:00Z') },
      // Thursday 10:50–11:30 Douala: within the pause after 10:00–10:45 only.
      { startsAt: new Date('2026-11-26T09:50:00Z'), endsAt: new Date('2026-11-26T10:30:00Z') },
    ];
    const days = freeSlots({ ...week, horizonDays: 2 }, busy, NOW);
    expect(days).toEqual([
      { day: '2026-11-24', starts: ['2026-11-24T08:00:00.000Z', '2026-11-24T09:00:00.000Z'] },
      { day: '2026-11-25', starts: [] },
      { day: '2026-11-26', starts: ['2026-11-26T08:00:00.000Z'] },
    ]);
  });

  it('lets a Réunion end right where the pause begins', () => {
    // Ends Wednesday 08:45 Douala: 09:00 keeps its 15-minute pause.
    const busy = [{ startsAt: new Date('2026-11-25T07:00:00Z'), endsAt: new Date('2026-11-25T07:45:00Z') }];
    expect(freeSlots(availability, busy, NOW)[0]!.starts).toContain('2026-11-25T08:00:00.000Z');
  });
});

it('leaves out a day wholly inside the notice, rather than showing it full', () => {
  const days = freeSlots({ ...availability, weeklyHours: [{ day: 2, start: '09:00', end: '11:00' }], minNoticeHours: 6 }, [], NOW);
  expect(days).toEqual([]);
});
