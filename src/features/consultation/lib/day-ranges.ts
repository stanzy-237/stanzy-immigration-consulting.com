/** A day's open hours, Douala time: `HH:MM` to `HH:MM`. */
export type DayRange = { day: number; start: string; end: string };

/** The step the timeline snaps to, and the shortest slot. */
export const STEP_MINUTES = 30;

export const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clockOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** « 09:00 » → « 9h », « 09:30 » → « 9h30 ». */
export const shortHour = (time: string): string => {
  const [h, m] = time.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};

/** « 9h–13h · 18h–22h ». */
export const shortRanges = (ranges: { start: string; end: string }[]): string =>
  ranges.map((r) => `${shortHour(r.start)}–${shortHour(r.end)}`).join(' · ');

const sorted = (ranges: DayRange[]) => ranges.toSorted((a, b) => a.start.localeCompare(b.start));

/** The latest time a slot can end: parseRanges reads hours up to 23. */
export const DAY_END = 23 * 60 + STEP_MINUTES;

/** True when `minutes` falls inside one of the ranges. */
export const isOpenAt = (ranges: DayRange[], minutes: number): boolean => ranges.some((r) => minutesOf(r.start) <= minutes && minutes < minutesOf(r.end));

/**
 * « + Ajouter 14h »: one hour from `start`, shortened to the next slot so
 * nothing overlaps. Unchanged when `start` is already open or nothing fits.
 */
export function addSlot(ranges: DayRange[], day: number, start: number): DayRange[] {
  if (isOpenAt(ranges, start) || start >= DAY_END) return ranges;
  const nextStart = Math.min(DAY_END, ...ranges.map((r) => minutesOf(r.start)).filter((m) => m > start));
  const end = Math.min(start + 60, nextStart);
  if (end - start < STEP_MINUTES) return ranges;
  return sorted([...ranges, { day, start: clockOf(start), end: clockOf(end) }]);
}

/** The first hour from 09:00 with room for a slot, else from 06:00; null when the day is full. */
export function firstFreeStart(ranges: DayRange[]): number | null {
  for (const from of [9 * 60, 6 * 60]) {
    for (let m = from; m + STEP_MINUTES <= DAY_END; m += 60) {
      if (addSlot(ranges, 0, m) !== ranges) return m;
    }
  }
  return null;
}

/** Drags one edge of the slot at `index`, snapped, kept between its neighbours and at least 30 minutes long. */
export function resizeSlot(ranges: DayRange[], index: number, edge: 'start' | 'end', minutes: number): DayRange[] {
  const list = sorted(ranges);
  const slot = list[index];
  if (!slot) return ranges;
  const snapped = Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
  const previousEnd = index > 0 ? minutesOf(list[index - 1]!.end) : 0;
  const nextStart = index < list.length - 1 ? minutesOf(list[index + 1]!.start) : DAY_END;
  const next =
    edge === 'start'
      ? { ...slot, start: clockOf(Math.min(Math.max(snapped, previousEnd), minutesOf(slot.end) - STEP_MINUTES)) }
      : { ...slot, end: clockOf(Math.max(Math.min(snapped, nextStart), minutesOf(slot.start) + STEP_MINUTES)) };
  return list.map((r, i) => (i === index ? next : r));
}

/** Sets a slot's exact hours; null when they are backwards or overlap another slot. */
export function setSlot(ranges: DayRange[], index: number, start: string, end: string): DayRange[] | null {
  const list = sorted(ranges);
  if (minutesOf(start) >= minutesOf(end)) return null;
  const others = list.filter((_, i) => i !== index);
  if (others.some((r) => minutesOf(start) < minutesOf(r.end) && minutesOf(r.start) < minutesOf(end))) return null;
  return sorted(list.map((r, i) => (i === index ? { ...r, start, end } : r)));
}

/** The times a slot can start or end, every 30 minutes. */
export const TIME_OPTIONS: string[] = Array.from({ length: DAY_END / STEP_MINUTES + 1 }, (_, i) => clockOf(i * STEP_MINUTES));

/** Slots that touch become one: 19h–21h and 21h–22h read 19h–22h. */
export function mergeTouching(ranges: DayRange[]): DayRange[] {
  const merged: DayRange[] = [];
  for (const range of sorted(ranges)) {
    const last = merged.at(-1);
    if (last && minutesOf(range.start) <= minutesOf(last.end)) {
      merged[merged.length - 1] = { ...last, end: clockOf(Math.max(minutesOf(last.end), minutesOf(range.end))) };
    } else merged.push(range);
  }
  return merged;
}
