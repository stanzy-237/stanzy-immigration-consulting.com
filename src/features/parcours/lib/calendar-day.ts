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
