import { DRAW_GROUPS, drawTypeKey, type DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/** A group's next expected Tirage, with the inputs that explain it. */
export type GroupPrediction = {
  group: DrawGroup;
  /** First and last day of the likely window, `YYYY-MM-DD`, calendar days. */
  windowStart: string;
  windowEnd: string;
  /** The window had already passed, so it was moved to start today. */
  overdue: boolean;
  /** The group's latest Tirage. */
  lastDraw: DrawSummary;
  /** The usual interval: the median gap in days between the group's Tirages. */
  gapDays: number;
  /** One Tirage in 12 months: `gapDays` is the other groups' cadence. */
  fallback: boolean;
  /** The group's Tirages in the 12 months before now. */
  countInYear: number;
  /** Cut-offs of the group's last 5 Tirages (`last` newest first). */
  scores: { min: number; max: number; median: number; last: number[] };
  /**
   * Catégorie only: the most likely specific type, as its latest Tirage, and
   * how many of the group's last `of` Tirages had it.
   */
  category: { draw: DrawSummary; count: number; of: number } | null;
};

export type DrawPrediction = { featured: GroupPrediction | null; byGroup: GroupPrediction[] };

const DAY_MS = 86_400_000;
/** Below this many gaps, quartiles mean little: the window is the median ± 2 days. */
const MIN_GAPS_FOR_QUARTILES = 4;
const SPREAD_DAYS = 2;
/** Used only when no group has two Tirages in 12 months. */
const DEFAULT_GAP_DAYS = 14;
const SCORE_SAMPLE = 5;
const TYPE_SAMPLE = 3;

/** Days since the epoch of a `YYYY-MM-DD` date, or of an instant's UTC day. */
const dayNumber = (date: string | Date) =>
  Math.floor((typeof date === 'string' ? Date.parse(`${date}T00:00:00Z`) : date.getTime()) / DAY_MS);
const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The middle of a sorted list; the two middles averaged, rounded, when it is even. */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Lower and upper quartiles: the medians of the halves either side of the median. */
function quartiles(sorted: number[]): [number, number] {
  const half = Math.floor(sorted.length / 2);
  return [median(sorted.slice(0, half)), median(sorted.slice(sorted.length - half))];
}

const ascending = (values: number[]) => values.toSorted((a, b) => a - b);

/** Gaps in days between a group's consecutive Tirage dates (same-day rounds count once). */
function gapsOf(days: number[]): number[] {
  const distinct = [...new Set(days)].toSorted((a, b) => a - b);
  return distinct.slice(1).map((day, i) => day - distinct[i]!);
}

/** The type most frequent among `draws` (newest first); ties go to the most recent. */
function likelyType(draws: DrawSummary[]): GroupPrediction['category'] {
  const keyOf = (draw: DrawSummary) => drawTypeKey(draw.typeLabel) ?? draw.typeLabel;
  const counts = new Map<string, number>();
  for (const draw of draws) counts.set(keyOf(draw), (counts.get(keyOf(draw)) ?? 0) + 1);
  // `draws` is newest first, so the first draw reaching the top count is the most recent.
  const top = Math.max(...counts.values());
  const pick = draws.find((draw) => counts.get(keyOf(draw)) === top)!;
  return { draw: pick, count: top, of: draws.length };
}

/**
 * The Prédiction de tirage: for each group with a Tirage in the 12 months
 * before `now`, a window for its next one (from the gaps between its recent
 * Tirages), the range of its last 5 cut-offs and, for Catégorie, the likely
 * type. The featured group is the one whose window starts first; a tie goes
 * to the group with more Tirages in 12 months. Statistics, not an announcement.
 */
export function predictNextDraws(draws: DrawSummary[], now: Date): DrawPrediction {
  const today = dayNumber(now);
  const since = dayNumber(new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())));
  const newestFirst = draws.toSorted((a, b) => b.date.localeCompare(a.date) || b.roundNumber - a.roundNumber);

  const active = DRAW_GROUPS.flatMap((group) => {
    const all = newestFirst.filter((draw) => draw.group === group);
    const recent = all.filter((draw) => dayNumber(draw.date) >= since);
    return recent.length ? [{ group, all, recent, gaps: gapsOf(recent.map((draw) => dayNumber(draw.date))) }] : [];
  });
  const pooledGaps = ascending(active.flatMap(({ gaps }) => gaps));

  const byGroup = active.map(({ group, all, recent, gaps }): GroupPrediction => {
    const lastDraw = recent[0]!;
    const last = dayNumber(lastDraw.date);
    const fallback = gaps.length === 0;
    const sortedGaps = ascending(gaps);
    const gapDays = fallback ? (pooledGaps.length ? median(pooledGaps) : DEFAULT_GAP_DAYS) : median(sortedGaps);
    const [low, high] =
      sortedGaps.length >= MIN_GAPS_FOR_QUARTILES ? quartiles(sortedGaps) : [Math.max(1, gapDays - SPREAD_DAYS), gapDays + SPREAD_DAYS];
    const overdue = last + high < today;
    const shift = overdue ? today - (last + low) : 0;

    const last5 = all.slice(0, SCORE_SAMPLE).map((draw) => draw.crsMin);
    const sortedScores = ascending(last5);

    return {
      group,
      windowStart: isoDay(last + low + shift),
      windowEnd: isoDay(last + high + shift),
      overdue,
      lastDraw,
      gapDays,
      fallback,
      countInYear: recent.length,
      scores: { min: sortedScores[0]!, max: sortedScores.at(-1)!, median: median(sortedScores), last: last5 },
      category: group === 'CATEGORY' ? likelyType(all.slice(0, TYPE_SAMPLE)) : null,
    };
  });

  const featured =
    byGroup.toSorted(
      (a, b) => a.windowStart.localeCompare(b.windowStart) || b.countInYear - a.countInYear,
    )[0] ?? null;
  return { featured, byGroup };
}

/**
 * A window's days at noon UTC (the same calendar day in every time zone) and
 * how wide it is, so copy can say « le 3 nov. », « entre le 3 et le 6 nov. »
 * or « entre le 30 oct. et le 3 nov. ».
 */
export function windowDays({ windowStart, windowEnd }: Pick<GroupPrediction, 'windowStart' | 'windowEnd'>) {
  const start = new Date(`${windowStart}T12:00:00Z`);
  const end = new Date(`${windowEnd}T12:00:00Z`);
  const span = windowStart === windowEnd ? 'day' : windowStart.slice(0, 7) === windowEnd.slice(0, 7) ? 'month' : 'other';
  return { start, end, span } as const;
}
