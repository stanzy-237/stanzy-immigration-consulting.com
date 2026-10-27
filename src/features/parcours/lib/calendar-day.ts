/**
 * Étape dates are calendar days (`YYYY-MM-DD`) with no time or zone, so every
 * comparison here happens on the User's own calendar, not in UTC.
 */

const DAY_IN_MS = 86_400_000;

const parts = (day: string): [number, number, number] => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return [year, month, date];
};

/** The User's today as a calendar day. */
export function todayOf(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole days from `day` to the User's today, never below 0. */
export function daysSince(day: string, now: Date): number {
  const [year, month, date] = parts(day);
  const then = Date.UTC(year, month - 1, date);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / DAY_IN_MS));
}

/** Midday on `day` in the User's zone, for formatting without a date shift. */
export function dateOf(day: string): Date {
  const [year, month, date] = parts(day);
  return new Date(year, month - 1, date, 12);
}

/** Étapes oldest first; same-day Étapes keep their order. */
export function sortByDate<T extends { date: string }>(etapes: readonly T[]): T[] {
  return [...etapes].sort((a, b) => a.date.localeCompare(b.date));
}

/** Whole days from `from` to `to`, both calendar days, never below 0. */
function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_IN_MS));
}

/**
 * The gap from `from` to `to` in calendar months and remaining days, plus the
 * total in days. A month only counts once its day-of-month is reached, so
 * 31 Jan → 28 Feb is 0 months 28 days; adding months clamps to the month's
 * last day (31 Jan + 1 month = 28 Feb), so 31 Jan → 1 Mar is 1 month 1 day.
 */
export function calendarDuration(from: string, to: string): { months: number; days: number; totalDays: number } {
  const totalDays = daysBetween(from, to);
  if (totalDays === 0) return { months: 0, days: 0, totalDays };
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  // Day 0 of the next month is the last day of this one.
  const anchorYear = y1 + Math.floor((m1 - 1 + months) / 12);
  const anchorMonth = ((m1 - 1 + months) % 12) + 1;
  const lastDay = new Date(Date.UTC(anchorYear, anchorMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const anchor = `${anchorYear}-${pad(anchorMonth)}-${pad(Math.min(d1, lastDay))}`;
  return { months, days: daysBetween(anchor, to), totalDays };
}
