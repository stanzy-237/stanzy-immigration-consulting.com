import type { Currency } from '@/features/invoices/lib/money';
import type { ServiceType } from '@/features/dossiers/data/workflows';

/** Fixed by the CFA franc's peg: 1 EUR = 655.957 XAF. */
export const XAF_PER_EUR = 655.957;

/** `xafPerCad` for each `YYYY-MM` the consultant entered. */
export type CadRates = Readonly<Record<string, number>>;

/** One Recette or Charge as the reports read it; `day` is `YYYY-MM-DD`. */
export type Entry = {
  kind: 'income' | 'charge';
  day: string;
  amount: number;
  currency: Currency;
  /** A Recette's service (a paid Facture's is its Dossier's). */
  service?: ServiceType | null;
  /** A Charge's category name. */
  category?: string | null;
  dossierId?: string | null;
};

export const monthOf = (day: string): string => day.slice(0, 7);

/**
 * `amount` (minor unit) in XAF, rounded to the franc: EUR at 655.957, CAD at
 * the month's rate. Null when that month has no CAD rate yet.
 */
export function toXaf(amount: number, currency: Currency, month: string, rates: CadRates): number | null {
  if (currency === 'XAF') return amount;
  if (currency === 'EUR') return Math.round((amount / 100) * XAF_PER_EUR);
  const rate = rates[month];
  return rate === undefined ? null : Math.round((amount / 100) * rate);
}

export type Totals = { income: number; charges: number; net: number };

const empty = (): Totals => ({ income: 0, charges: 0, net: 0 });

function add(totals: Totals, entry: Entry, xaf: number): void {
  if (entry.kind === 'income') totals.income += xaf;
  else totals.charges += xaf;
  totals.net = totals.income - totals.charges;
}

export type YearReport = {
  year: number;
  total: Totals;
  /** January to December. */
  months: Totals[];
  /** Recettes per service; `null` holds those with no service (a source instead). */
  byService: { service: ServiceType | null; income: number }[];
  /** Charges per category, largest first. */
  byCategory: { category: string; charges: number }[];
  /** Months with CAD amounts but no rate: those amounts are left out until it is entered. */
  missingRates: string[];
};

/** Recettes against Charges for `year`, in XAF, per month, service and category. */
export function yearReport(entries: Entry[], rates: CadRates, year: number): YearReport {
  const months = Array.from({ length: 12 }, empty);
  const total = empty();
  const services = new Map<ServiceType | null, number>();
  const categories = new Map<string, number>();
  const missing = new Set<string>();

  for (const entry of entries) {
    if (!entry.day.startsWith(`${year}-`)) continue;
    const month = monthOf(entry.day);
    const xaf = toXaf(entry.amount, entry.currency, month, rates);
    if (xaf === null) {
      missing.add(month);
      continue;
    }
    add(months[Number(month.slice(5)) - 1]!, entry, xaf);
    add(total, entry, xaf);
    if (entry.kind === 'income') {
      const service = entry.service ?? null;
      services.set(service, (services.get(service) ?? 0) + xaf);
    } else {
      const category = entry.category ?? '';
      categories.set(category, (categories.get(category) ?? 0) + xaf);
    }
  }

  return {
    year,
    total,
    months,
    byService: [...services].map(([service, income]) => ({ service, income })).sort((a, b) => b.income - a.income),
    byCategory: [...categories]
      .map(([category, charges]) => ({ category, charges }))
      .sort((a, b) => b.charges - a.charges),
    missingRates: [...missing].sort(),
  };
}

/** What each Dossier brought in, cost, and the margin, in XAF; biggest margin first. */
export function dossierMargins(entries: Entry[], rates: CadRates): (Totals & { dossierId: string })[] {
  const byDossier = new Map<string, Totals>();
  for (const entry of entries) {
    if (!entry.dossierId) continue;
    const xaf = toXaf(entry.amount, entry.currency, monthOf(entry.day), rates);
    if (xaf === null) continue;
    const totals = byDossier.get(entry.dossierId) ?? empty();
    add(totals, entry, xaf);
    byDossier.set(entry.dossierId, totals);
  }
  return [...byDossier].map(([dossierId, totals]) => ({ dossierId, ...totals })).sort((a, b) => b.net - a.net);
}
