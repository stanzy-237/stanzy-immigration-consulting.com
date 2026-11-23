import { addDays, doualaDay } from '@/features/notifications/lib/douala-days';

const MINUTE = 60 * 1000;
/** Douala is UTC+1 all year (no summer time). */
const DOUALA_OFFSET_MS = 60 * MINUTE;

/** Open hours on one weekday, Douala time. `day`: ISO weekday, 1 = Monday … 7 = Sunday. */
export type WeeklyWindow = { day: number; start: string; end: string };

/** Disponibilités: when a Consultation can be booked. */
export type Availability = {
  durationMinutes: number;
  /** The pause kept free before and after each Réunion. */
  bufferMinutes: number;
  /** How early one can book: no start sooner than this after now. */
  minNoticeHours: number;
  /** How far ahead: the last bookable day is today (Douala) plus this. */
  horizonDays: number;
  weeklyHours: WeeklyWindow[];
  /** « Bloquer une date »: `YYYY-MM-DD` days with no booking at all. */
  blockedDates: string[];
};

/** Time already taken: a Réunion, or a slot held for someone else. */
export type Busy = { startsAt: Date; endsAt: Date };

/** A bookable day and its free starts (ISO). A day with open hours but nothing free has no starts. */
export type SlotDay = { day: string; starts: string[] };

/** ISO weekday (1 = Monday) of a `YYYY-MM-DD`. */
const weekday = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;

/** The instant of `HH:MM` on `day`, Douala time. */
const at = (day: string, time: string): number => Date.parse(`${day}T${time}:00Z`) - DOUALA_OFFSET_MS;

/**
 * The free Consultation starts from today (Douala) to the horizon: each open
 * window is cut into the Consultation's length plus the pause; a start is
 * free when it respects the notice and nothing busy falls within the pause
 * around it.
 */
export function freeSlots(availability: Availability, busy: Busy[], now: Date): SlotDay[] {
  const { durationMinutes, bufferMinutes, minNoticeHours, horizonDays, weeklyHours, blockedDates } = availability;
  const length = durationMinutes * MINUTE;
  const pause = bufferMinutes * MINUTE;
  const earliest = now.getTime() + minNoticeHours * 60 * MINUTE;
  const blocked = new Set(blockedDates);
  const today = doualaDay(now);
  const days: SlotDay[] = [];

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(today, offset);
    const windows = weeklyHours.filter((window) => window.day === weekday(day));
    if (windows.length === 0 || blocked.has(day)) continue;

    const starts: string[] = [];
    let open = false;
    for (const window of windows) {
      const end = at(day, window.end);
      for (let start = at(day, window.start); start + length <= end; start += length + pause) {
        if (start < earliest) continue;
        open = true;
        const taken = busy.some(
          (b) => b.startsAt.getTime() < start + length + pause && b.endsAt.getTime() > start - pause,
        );
        if (!taken) starts.push(new Date(start).toISOString());
      }
    }
    // A day wholly inside the notice is not offered; a day booked full is shown with no starts.
    if (open) days.push({ day, starts: starts.sort() });
  }
  return days;
}
