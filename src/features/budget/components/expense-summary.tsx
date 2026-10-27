'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { Currency } from '@/features/budget/data/currencies';
import { MOTIFS } from '@/features/budget/data/motifs';
import { useFormatMoney } from '@/features/budget/hooks/use-format-money';
import type { Expense } from '@/features/budget/lib/budget-schema';
import { fromMinor } from '@/features/budget/lib/money';

/**
 * The journal's head: the total spent, how far into the estimated budget it
 * is, and the subtotal for each reason that has a Dépense.
 */
export function ExpenseSummary({
  expenses,
  currency,
  budget,
}: {
  expenses: readonly Expense[];
  currency: Currency;
  /** The saved estimate's fees in `currency`, whole units; null without one. */
  budget: number | null;
}): ReactNode {
  const t = useTranslations('Budget');
  const money = useFormatMoney();
  const totalMinor = expenses.reduce((sum, e) => sum + e.amount, 0);
  const spent = fromMinor(totalMinor, currency);
  const byMotif = MOTIFS.map((motif) => ({
    motif,
    amount: expenses.filter((e) => e.motif === motif).reduce((sum, e) => sum + e.amount, 0),
  })).filter((row) => row.amount > 0);
  const percent = budget ? Math.round((spent / budget) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section
        aria-labelledby="budget-total-title"
        className="rounded-2xl bg-linear-135 from-navy-deep to-navy-80 p-6 text-white"
      >
        <h2 id="budget-total-title" className="font-label uppercase tracking-widest text-white/70">
          {t('journal.total')}
        </h2>
        <p className="mt-2 font-heading text-h3 font-bold">{money(spent, currency)}</p>
        {budget ? (
          <div className="mt-5">
            <p className="text-body-sm text-white/80">
              {t('journal.progress', { spent: money(spent, currency), budget: money(budget, currency, true) })}
            </p>
            <div
              role="progressbar"
              aria-label={t('journal.progressLabel')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15"
            >
              <div
                className={`h-full rounded-full ${percent > 100 ? 'bg-rose' : 'bg-rouge'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-body-sm text-white/70">{t('journal.noEstimate')}</p>
        )}
      </section>

      <section aria-labelledby="budget-by-motif-title" className="rounded-2xl border-2 border-fog-light bg-white p-6">
        <h2 id="budget-by-motif-title" className="font-label uppercase tracking-widest text-slate">
          {t('journal.byMotif')}
        </h2>
        {byMotif.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {byMotif.map(({ motif, amount }) => (
              <li
                key={motif}
                aria-labelledby={`budget-motif-${motif}`}
                className="flex items-baseline justify-between gap-3 text-body-sm"
              >
                <span id={`budget-motif-${motif}`} className="text-slate">
                  {t(`motifs.${motif}`)}
                </span>
                <span className="font-semibold text-navy-deep">{money(fromMinor(amount, currency), currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body-sm text-slate">—</p>
        )}
      </section>
    </div>
  );
}
