import { doualaDay } from '@/features/notifications/lib/douala-days';

/** The year a Finances page shows: `?annee=` when it is a sensible year, else this one (Douala). */
export function financeYear(raw: string | string[] | undefined, now = new Date()): number {
  const year = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : Number(doualaDay(now).slice(0, 4));
}
