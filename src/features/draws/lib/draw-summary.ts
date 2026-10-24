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
};

/** IRCC's order: by date, then number, then the split rounds' letter (91a, 91b). */
export function roundOrder(dir: 'asc' | 'desc') {
  return [{ date: dir }, { roundNumber: dir }, { round: dir }] as const;
}
