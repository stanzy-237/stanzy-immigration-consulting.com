import { describe, expect, it } from 'vitest';

import { addSlot, firstFreeStart, mergeTouching, resizeSlot, setSlot, shortRanges } from '@/features/consultation/lib/day-ranges';

const monday = [
  { day: 1, start: '09:00', end: '13:00' },
  { day: 1, start: '18:00', end: '22:00' },
];

describe('a day’s slots', () => {
  it('reads short: « 9h–13h · 18h–22h », half hours kept', () => {
    expect(shortRanges(monday)).toBe('9h–13h · 18h–22h');
    expect(shortRanges([{ start: '09:30', end: '12:00' }])).toBe('9h30–12h');
  });

  it('adds an hour where the pointer is, shortened before the next slot, never inside one', () => {
    expect(addSlot(monday, 1, 14 * 60)).toEqual([monday[0], { day: 1, start: '14:00', end: '15:00' }, monday[1]]);
    expect(addSlot(monday, 1, 17 * 60 + 30)).toEqual([monday[0], { day: 1, start: '17:30', end: '18:00' }, monday[1]]);
    expect(addSlot(monday, 1, 10 * 60)).toBe(monday);
    expect(addSlot([], 4, 9 * 60)).toEqual([{ day: 4, start: '09:00', end: '10:00' }]);
  });

  it('finds the first free hour from 9h, for the keyboard « + »', () => {
    expect(firstFreeStart([])).toBe(9 * 60);
    expect(firstFreeStart(monday)).toBe(13 * 60);
  });

  it('drags an edge in 30-minute steps, between its neighbours, never under 30 minutes', () => {
    expect(resizeSlot(monday, 0, 'end', 14 * 60 + 10)[0]).toEqual({ day: 1, start: '09:00', end: '14:00' });
    expect(resizeSlot(monday, 0, 'end', 20 * 60)[0]!.end).toBe('18:00');
    expect(resizeSlot(monday, 1, 'start', 22 * 60)[1]!.start).toBe('21:30');
  });

  it('joins slots that touch', () => {
    expect(mergeTouching([{ day: 1, start: '21:00', end: '22:00' }, { day: 1, start: '19:00', end: '21:00' }, monday[0]!])).toEqual([monday[0], { day: 1, start: '19:00', end: '22:00' }]);
  });

  it('sets exact hours, or refuses backwards or overlapping ones', () => {
    expect(setSlot(monday, 1, '18:30', '21:00')).toEqual([monday[0], { day: 1, start: '18:30', end: '21:00' }]);
    expect(setSlot(monday, 1, '21:00', '18:00')).toBeNull();
    expect(setSlot(monday, 1, '12:00', '19:00')).toBeNull();
  });
});
