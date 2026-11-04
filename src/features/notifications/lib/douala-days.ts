const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of `date` in Douala, where the practice works (UTC+1, no summer time). */
export const doualaDay = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(date);

/** `YYYY-MM-DD` `days` after `day`. */
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
