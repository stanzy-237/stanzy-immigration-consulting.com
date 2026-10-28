import { DRAW_GROUPS, drawTypeKey, type DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/** How often the method found a group's past Tirages, replayed over the 12 months before now. */
export type Reliability = {
  level: 'high' | 'medium' | 'low';
  /** Share of replays whose Tirage fell in the predicted week, the exact day, the score range. */
  weekRate: number;
  dayRate: number;
  scoreRate: number;
  /** How many Tirages were replayed. */
  sample: number;
};

/** A group's next expected Tirage, with the inputs that explain it. */
export type GroupPrediction = {
  group: DrawGroup;
  /**
   * The likely day and its week (Monday to Sunday), `YYYY-MM-DD`. `precise`
   * when the group keeps to its weekday well enough to name the day; otherwise
   * only the week should be shown.
   */
  date: { precise: boolean; day: string; weekStart: string; weekEnd: string };
  /** The predicted day had already passed, so it moved to the next usual weekday. */
  overdue: boolean;
  /** The group's latest Tirage. */
  lastDraw: DrawSummary;
  /** The usual interval: the median gap in days between the group's recent Tirages. */
  gapDays: number;
  /** One Tirage in 12 months: `gapDays` is the other groups' cadence. */
  fallback: boolean;
  /** The weekday most of the group's Tirages fall on (0 Sunday … 6 Saturday), and that share of them. */
  usualWeekday: number;
  weekdayShare: number;
  /** The group's Tirages in the 12 months before now. */
  countInYear: number;
  /**
   * The likely cut-off: `center` is the median of the last 3, `low`–`high`
   * that give or take 1.5 times the usual change. `last` is newest first.
   * Catégorie reads its likely type's Tirages only.
   */
  scores: { center: number; low: number; high: number; last: number[] };
  /**
   * Catégorie only: the most likely specific type, as its latest Tirage, and
   * how many of the group's last `of` Tirages had it.
   */
  category: { draw: DrawSummary; count: number; of: number } | null;
  /** Null when fewer than 4 past Tirages could be replayed. */
  reliability: Reliability | null;
};

export type DrawPrediction = { featured: GroupPrediction | null; byGroup: GroupPrediction[] };

const DAY_MS = 86_400_000;
/** Used only when no group has two Tirages in 12 months. */
const DEFAULT_GAP_DAYS = 14;
const GAP_SAMPLE = 8;
const CENTER_SAMPLE = 3;
const CHANGE_SAMPLE = 7;
const SCORE_SAMPLE = 5;
const TYPE_SAMPLE = 3;
const CHANGE_FACTOR = 1.5;
const MIN_HALF_RANGE = 4;
/** The day is only named when the method found it this often, or, untested, the weekday share. */
const PRECISE_DAY_RATE = 0.35;
const PRECISE_WEEKDAY_SHARE = 0.6;
const MIN_REPLAYS = 4;
const HIGH_WEEK_RATE = 0.8;
const MEDIUM_WEEK_RATE = 0.55;

/** Days since the epoch of a `YYYY-MM-DD` date, or of an instant's UTC day. */
const dayNumber = (date: string | Date) =>
  Math.floor((typeof date === 'string' ? Date.parse(`${date}T00:00:00Z`) : date.getTime()) / DAY_MS);
const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** 0 Sunday … 6 Saturday; day 0 (1970-01-01) was a Thursday. */
const weekdayOf = (day: number) => (day + 4) % 7;
/** The Monday on or before `day`. */
const mondayOf = (day: number) => day - ((weekdayOf(day) + 6) % 7);
/** The day a year before `day`, same calendar date. */
const yearBefore = (day: number) => {
  const date = new Date(day * DAY_MS);
  return dayNumber(new Date(Date.UTC(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate())));
};

/** The middle of a list; the two middles averaged when it is even. */
function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Gaps in days between consecutive distinct days, oldest first. */
const gapsOf = (ascendingDays: number[]) => ascendingDays.slice(1).map((day, i) => day - ascendingDays[i]!);

const typeKey = (draw: DrawSummary) => drawTypeKey(draw.typeLabel) ?? draw.typeLabel;

/** The type most frequent among `draws` (newest first); ties go to the most recent. */
function likelyType(draws: DrawSummary[]): NonNullable<GroupPrediction['category']> {
  const counts = new Map<string, number>();
  for (const draw of draws) counts.set(typeKey(draw), (counts.get(typeKey(draw)) ?? 0) + 1);
  // `draws` is newest first, so the first draw reaching the top count is the most recent.
  const top = Math.max(...counts.values());
  const pick = draws.find((draw) => counts.get(typeKey(draw)) === top)!;
  return { draw: pick, count: top, of: draws.length };
}

type Forecast = Pick<
  GroupPrediction,
  'overdue' | 'gapDays' | 'fallback' | 'usualWeekday' | 'weekdayShare' | 'countInYear' | 'scores' | 'category'
> & { day: number };

/**
 * One group's forecast from its Tirages (newest first, none on or after
 * `today`), without reliability. `pooledGap` stands in when the group has a
 * single Tirage in the 12 months before `today`.
 */
function forecast(group: DrawGroup, all: DrawSummary[], today: number, pooledGap: number): Forecast {
  const since = yearBefore(today);
  const recent = all.filter((draw) => dayNumber(draw.date) >= since);
  const days = [...new Set(recent.map((draw) => dayNumber(draw.date)))].toSorted((a, b) => a - b);
  const gaps = gapsOf(days).slice(-GAP_SAMPLE);
  const fallback = gaps.length === 0;
  const gap = fallback ? pooledGap : median(gaps);

  // The usual weekday; a tie goes to the most recent Tirage's.
  const counts = new Map<number, number>();
  for (const draw of recent) {
    const weekday = weekdayOf(dayNumber(draw.date));
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  const top = Math.max(...counts.values());
  const usualWeekday = recent.map((draw) => weekdayOf(dayNumber(draw.date))).find((wd) => counts.get(wd) === top)!;

  // That weekday within 3 days of one usual gap after the last Tirage; once
  // passed, the next one from today.
  const target = days.at(-1)! + Math.round(gap);
  const onWeekday = target + ((usualWeekday - weekdayOf(target) + 10) % 7) - 3;
  const overdue = onWeekday < today;
  const day = overdue ? today + ((usualWeekday - weekdayOf(today) + 7) % 7) : onWeekday;

  const category = group === 'CATEGORY' ? likelyType(all.slice(0, TYPE_SAMPLE)) : null;
  const series = (category ? all.filter((draw) => typeKey(draw) === typeKey(category.draw)) : all).map(
    (draw) => draw.crsMin,
  );
  const center = Math.round(median(series.slice(0, CENTER_SAMPLE)));
  const changes = gapsOf(series.slice(0, CHANGE_SAMPLE).toReversed()).map(Math.abs);
  const half = Math.max(MIN_HALF_RANGE, Math.round(CHANGE_FACTOR * (changes.length ? median(changes) : 0)));

  return {
    day,
    overdue,
    gapDays: Math.round(gap),
    fallback,
    usualWeekday,
    weekdayShare: top / recent.length,
    countInYear: recent.length,
    scores: { center, low: center - half, high: center + half, last: series.slice(0, SCORE_SAMPLE) },
    category,
  };
}

/**
 * Replays the method on each of the group's Tirages in the 12 months before
 * `today` that had two earlier ones in the 12 months before it, as seen the
 * day after the Tirage before it.
 */
function reliabilityOf(group: DrawGroup, all: DrawSummary[], today: number): Reliability | null {
  const days = [...new Set(all.map((draw) => dayNumber(draw.date)))].toSorted((a, b) => a - b);
  const since = yearBefore(today);
  const replays = days.flatMap((actual, i) => {
    if (actual < since || i < 2 || days[i - 2]! < yearBefore(actual)) return [];
    const asOf = days[i - 1]! + 1;
    const seen = all.filter((draw) => dayNumber(draw.date) < asOf);
    const { day, scores } = forecast(group, seen, asOf, DEFAULT_GAP_DAYS);
    const crs = all.filter((draw) => dayNumber(draw.date) === actual).map((draw) => draw.crsMin);
    return [
      {
        week: mondayOf(day) === mondayOf(actual),
        day: day === actual,
        score: crs.some((score) => score >= scores.low && score <= scores.high),
      },
    ];
  });
  if (replays.length < MIN_REPLAYS) return null;

  const rate = (hit: (replay: (typeof replays)[number]) => boolean) => replays.filter(hit).length / replays.length;
  const weekRate = rate((r) => r.week);
  return {
    level: weekRate >= HIGH_WEEK_RATE ? 'high' : weekRate >= MEDIUM_WEEK_RATE ? 'medium' : 'low',
    weekRate,
    dayRate: rate((r) => r.day),
    scoreRate: rate((r) => r.score),
    sample: replays.length,
  };
}

/**
 * The Prédiction de tirage: for each group with a Tirage in the 12 months
 * before `now`, its likely next day (its usual weekday, one usual gap after
 * its last Tirage) and week, its likely cut-off range and, for Catégorie, the
 * likely type, with how often the method was right over the past year. The
 * featured group is the one expected first; a tie goes to the group with more
 * Tirages in 12 months. Statistics, not an announcement.
 */
export function predictNextDraws(draws: DrawSummary[], now: Date): DrawPrediction {
  const today = dayNumber(now);
  const since = yearBefore(today);
  const newestFirst = draws
    .filter((draw) => dayNumber(draw.date) <= today)
    .toSorted((a, b) => b.date.localeCompare(a.date) || b.roundNumber - a.roundNumber);

  const active = DRAW_GROUPS.flatMap((group) => {
    const all = newestFirst.filter((draw) => draw.group === group);
    const recentDays = [
      ...new Set(all.filter((draw) => dayNumber(draw.date) >= since).map((d) => dayNumber(d.date))),
    ].toSorted((a, b) => a - b);
    return recentDays.length ? [{ group, all, gaps: gapsOf(recentDays).slice(-GAP_SAMPLE) }] : [];
  });
  const pooled = active.flatMap(({ gaps }) => gaps);
  const pooledGap = pooled.length ? median(pooled) : DEFAULT_GAP_DAYS;

  const byGroup = active.map(({ group, all }): GroupPrediction => {
    const { day, ...rest } = forecast(group, all, today, pooledGap);
    const reliability = reliabilityOf(group, all, today);
    const precise = reliability ? reliability.dayRate >= PRECISE_DAY_RATE : rest.weekdayShare >= PRECISE_WEEKDAY_SHARE;
    const monday = mondayOf(day);
    return {
      group,
      date: { precise, day: isoDay(day), weekStart: isoDay(monday), weekEnd: isoDay(monday + 6) },
      lastDraw: all[0]!,
      ...rest,
      reliability,
    };
  });

  const featured =
    byGroup.toSorted((a, b) => a.date.day.localeCompare(b.date.day) || b.countInYear - a.countInYear)[0] ?? null;
  return { featured, byGroup };
}

/** A `YYYY-MM-DD` at noon UTC: the same calendar day in every time zone, for formatting. */
export const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);
