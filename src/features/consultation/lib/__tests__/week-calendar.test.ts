import { describe, expect, it } from 'vitest';

import { doualaClock, hourRange, isDay, mondayOf, placeOnGrid, weekDays } from '@/features/consultation/lib/week-calendar';

const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`);
const hours = [
  { day: 1, start: '09:00', end: '12:00' },
  { day: 1, start: '14:00', end: '16:00' },
  { day: 3, start: '14:00', end: '17:00' },
];

describe('the week calendar', () => {
  it('starts weeks on Monday, Sunday included in the week before', () => {
    expect(mondayOf('2026-11-26')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
    expect(weekDays('2026-11-23')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    expect(isDay('2026-11-23')).toBe(true);
    expect(isDay('23/11/2026')).toBe(false);
  });

  it('reads instants in Douala time, even near midnight UTC', () => {
    expect(doualaClock(at('2026-11-26', '00:30'))).toEqual({ day: '2026-11-26', minutes: 30 });
    expect(doualaClock(at('2026-11-26', '14:00'))).toEqual({ day: '2026-11-26', minutes: 840 });
  });

  it('draws from the earliest open hour to the latest, widened for a Réunion outside them', () => {
    const week = weekDays('2026-11-23');
    expect(hourRange(week, hours, [])).toEqual({ from: 9, to: 17 });
    expect(hourRange(week, hours, [{ startsAt: at('2026-11-26', '18:30'), durationMinutes: 45 }])).toEqual({ from: 9, to: 20 });
    expect(hourRange(week, hours, [{ startsAt: at('2026-12-01', '07:00'), durationMinutes: 45 }])).toEqual({ from: 9, to: 17 });
    expect(hourRange(['2026-11-25'], hours, [])).toEqual({ from: 14, to: 17 });
    expect(hourRange(['2026-11-28'], hours, [])).toEqual({ from: 9, to: 17 });
  });

  it('places a block in minutes from the top, clipped to the grid', () => {
    expect(placeOnGrid(600, 645, { from: 9, to: 17 })).toEqual({ top: 60, height: 45 });
    expect(placeOnGrid(480, 600, { from: 9, to: 17 })).toEqual({ top: 0, height: 60 });
    expect(placeOnGrid(1080, 1140, { from: 9, to: 17 })).toBeNull();
  });
});
