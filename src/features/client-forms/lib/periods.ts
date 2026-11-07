/** A month as IRCC asks for it: `YYYY-MM`. */
export type Month = string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonth = (value: string): boolean => MONTH.test(value);

/** Months since year 0, so ranges can be compared and counted. */
const index = (month: Month): number => {
  const [, year, mm] = MONTH.exec(month)!;
  return Number(year) * 12 + Number(mm) - 1;
};
const fromIndex = (value: number): Month => `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, '0')}`;

export const monthOf = (date: Date): Month => fromIndex(date.getUTCFullYear() * 12 + date.getUTCMonth());
export const addMonths = (month: Month, count: number): Month => fromIndex(index(month) + count);
export const compareMonths = (a: Month, b: Month): number => index(a) - index(b);

/**
 * The period IRCC wants covered without a gap (Annexe A): the last 10 years,
 * or since the 18th birthday when that is later, up to this month.
 */
export function requiredWindow(today: Date, birthDate: string | null): { from: Month; to: Month } {
  const to = monthOf(today);
  const tenYears = addMonths(to, -10 * 12 + 1);
  if (!birthDate) return { from: tenYears, to };
  const eighteen = monthOf(new Date(`${birthDate}T00:00:00Z`));
  const adult = addMonths(eighteen, 18 * 12);
  return { from: compareMonths(adult, tenYears) > 0 ? adult : tenYears, to };
}

export type Period = { from: Month; to: Month | null };

/**
 * The months of `window` no period covers, as ranges (`from`–`to`,
 * inclusive): what IRCC would see as a gap. A period without an end runs to
 * this month; periods may overlap; unreadable ones are ignored.
 */
export function gapsIn(periods: Period[], window: { from: Month; to: Month }): { from: Month; to: Month }[] {
  const start = index(window.from);
  const end = index(window.to);
  if (end < start) return [];
  const covered = new Array<boolean>(end - start + 1).fill(false);
  for (const period of periods) {
    if (!isMonth(period.from) || (period.to !== null && !isMonth(period.to))) continue;
    const from = Math.max(index(period.from), start);
    const to = Math.min(period.to === null ? end : index(period.to), end);
    for (let month = from; month <= to; month++) covered[month - start] = true;
  }
  const gaps: { from: Month; to: Month }[] = [];
  let open: number | null = null;
  covered.forEach((isCovered, offset) => {
    if (!isCovered && open === null) open = offset;
    if (isCovered && open !== null) {
      gaps.push({ from: fromIndex(start + open), to: fromIndex(start + offset - 1) });
      open = null;
    }
  });
  if (open !== null) gaps.push({ from: fromIndex(start + open), to: window.to });
  return gaps;
}
