/** `YYYY-MM` `count` months after `month`. */
export function addMonths(month: string, count: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

const daysIn = (month: string): number =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

/**
 * The copies a monthly Charge made on `modelDay` is due by `today` (both
 * `YYYY-MM-DD`): one per month after its own, up to this month, on the
 * same day (the 31st becomes the month's last). At most 24, so a long
 * pause never floods the list.
 */
export function copiesDue(modelDay: string, today: string): { month: string; day: string }[] {
  const copies: { month: string; day: string }[] = [];
  const day = Number(modelDay.slice(8, 10));
  for (let month = addMonths(modelDay.slice(0, 7), 1); month <= today.slice(0, 7); month = addMonths(month, 1)) {
    const date = `${month}-${String(Math.min(day, daysIn(month))).padStart(2, '0')}`;
    if (date <= today) copies.push({ month, day: date });
  }
  return copies.slice(-24);
}
