import { addDays, doualaDay } from '@/features/notifications/lib/douala-days';
import { MINUTE, type WeeklyWindow } from '@/features/consultation/lib/slots';

/** Douala is UTC+1 all year (no summer time). */
const DOUALA_OFFSET_MS = 60 * MINUTE;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` day, as the calendar takes it. */
export const isDay = (value: string): boolean => DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD`. */
export const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;

/** The Monday of `day`'s week. */
export const mondayOf = (day: string): string => addDays(day, 1 - weekdayOf(day));

/** The seven days, Monday to Sunday, of the week starting `monday`. */
export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** The instant `day` begins in Douala. */
export const startOfDay = (day: string): Date => new Date(Date.parse(`${day}T00:00:00Z`) - DOUALA_OFFSET_MS);

/** Where an instant falls in Douala: its day and the minutes since that day's midnight. */
export function doualaClock(date: Date): { day: string; minutes: number } {
  const day = doualaDay(date);
  return { day, minutes: Math.round((date.getTime() - startOfDay(day).getTime()) / MINUTE) };
}

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
};

/** Something on the calendar: a Consultation or another Réunion. */
export type Timed = { startsAt: Date; durationMinutes: number };

/** The hours the grid shows: whole hours, from `from` (inclusive) to `to` (exclusive end). */
export type HourRange = { from: number; to: number };

/**
 * The hours to draw for some days: from the earliest open hour (or event) to
 * the latest, rounded out to whole hours. With nothing open and nothing
 * booked, 09:00 – 17:00.
 */
export function hourRange(days: string[], weeklyHours: WeeklyWindow[], events: Timed[]): HourRange {
  const weekdays = new Set(days.map(weekdayOf));
  const inDays = new Set(days);
  const spans: [number, number][] = weeklyHours.filter((w) => weekdays.has(w.day)).map((w) => [toMinutes(w.start), toMinutes(w.end)]);
  for (const event of events) {
    const { day, minutes } = doualaClock(event.startsAt);
    if (inDays.has(day)) spans.push([minutes, Math.min(24 * 60, minutes + event.durationMinutes)]);
  }
  if (spans.length === 0) return { from: 9, to: 17 };
  const from = Math.floor(Math.min(...spans.map(([s]) => s)) / 60);
  const to = Math.ceil(Math.max(...spans.map(([, e]) => e)) / 60);
  return { from, to: Math.max(to, from + 1) };
}

/** Where to draw a block, in minutes from the top of the grid; null when it is outside. */
export function placeOnGrid(startMinutes: number, endMinutes: number, range: HourRange): { top: number; height: number } | null {
  const top = Math.max(startMinutes, range.from * 60);
  const bottom = Math.min(endMinutes, range.to * 60);
  if (bottom <= top) return null;
  return { top: top - range.from * 60, height: bottom - top };
}

/** A day's open hours, in minutes since midnight, Douala time. */
export const openSpans = (day: string, weeklyHours: WeeklyWindow[]): [number, number][] =>
  weeklyHours.filter((w) => w.day === weekdayOf(day)).map((w) => [toMinutes(w.start), toMinutes(w.end)]);
