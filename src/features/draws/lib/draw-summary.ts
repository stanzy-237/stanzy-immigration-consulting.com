import type { DrawGroup } from '@/features/draws/lib/draw-type';

/** A Tirage as pages show it; never the raw feed. */
export type DrawSummary = {
  round: string;
  roundNumber: number;
  /** `YYYY-MM-DD`. */
  date: string;
  typeLabel: string;
  group: DrawGroup;
  invitations: number;
  crsMin: number;
  irccUrl: string | null;
  /** `crsMin` minus the previous Tirage of the same group; null for the first one. */
  crsChange: number | null;
  /**
   * The tie-breaking rule, as an ISO instant (UTC): among candidates at the
   * cut-off score, those who entered the pool before it were invited. Null
   * when IRCC gave none.
   */
  tieBreakAt: string | null;
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * IRCC's « October 06, 2026 at 21:31:22 UTC » as an ISO instant. IRCC's times
 * are UTC, also when it leaves the suffix off; anything else reads as null.
 */
export function irccInstant(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (!match) return null;
  const [, monthName = '', day = '', year = '', hour = '', minute = '', second = '0'] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase());
  if (month < 0) return null;
  return new Date(Date.UTC(+year, month, +day, +hour, +minute, +second)).toISOString();
}

/** IRCC's order: by date, then number, then the split rounds' letter (91a, 91b). */
export function roundOrder(dir: 'asc' | 'desc') {
  return [{ date: dir }, { roundNumber: dir }, { round: dir }] as const;
}
