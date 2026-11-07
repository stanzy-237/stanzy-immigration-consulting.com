/** The public Outil PDF's free allowance: compressions per calendar month (UTC). A paid plan comes later. */
export const FREE_COMPRESSIONS_PER_MONTH = 10;

/** The heaviest file the Outil PDF accepts, in bytes (100 Mo). */
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

/** The first instant of `now`'s calendar month and of the next one, in UTC: the allowance's window. */
export function monthWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
