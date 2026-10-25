/** Days IRCC gives to submit an application after an ITA, not counting the ITA day. */
export const ITA_WINDOW_DAYS = 60;

const DAY_IN_MS = 86_400_000;

const utcDay = (day: string): number => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
};

const toDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * ITA days are UTC calendar days, like the deadline: `YYYY-MM-DD` as the
 * Date at its 00:00 UTC, for formatting with `timeZone: 'UTC'`.
 */
export const utcDate = (day: string): Date => new Date(utcDay(day));

/** Today on the UTC calendar: the latest day an ITA can carry. */
export const utcToday = (now: Date): string => toDay(now.getTime());

export type ItaDeadline = {
  /** The last of the 60 days, `YYYY-MM-DD`. */
  lastDay: string;
  /** When the window closes: 00:00 UTC the day after `lastDay`. */
  closesAt: Date;
};

/**
 * The submission deadline of an ITA received on `itaDay` (`YYYY-MM-DD`): the
 * 60 days after it, the window closing at 00:00 UTC once the last one ends.
 */
export function itaDeadline(itaDay: string): ItaDeadline {
  const closes = utcDay(itaDay) + (ITA_WINDOW_DAYS + 1) * DAY_IN_MS;
  return { lastDay: toDay(closes - DAY_IN_MS), closesAt: new Date(closes) };
}

export type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Share of the window still ahead, 0 to 1. */
  share: number;
  expired: boolean;
};

/** What is left of the window that closes at `closesAt`, seen at `now`. */
export function timeLeft(closesAt: Date, now: Date): TimeLeft {
  const ms = Math.max(0, closesAt.getTime() - now.getTime());
  return {
    days: Math.floor(ms / DAY_IN_MS),
    hours: Math.floor((ms % DAY_IN_MS) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    share: Math.min(1, ms / (ITA_WINDOW_DAYS * DAY_IN_MS)),
    expired: ms === 0,
  };
}
