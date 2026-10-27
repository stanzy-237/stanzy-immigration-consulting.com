/**
 * A calendar day (`YYYY-MM-DD`) as noon UTC, to format with `timeZone: 'UTC'`
 * so the day printed never shifts with the reader's zone.
 */
export const noonUtc = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** `format.dateTime` options for a calendar day: « 27 octobre 2026 ». */
export const LONG_DAY = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const;
