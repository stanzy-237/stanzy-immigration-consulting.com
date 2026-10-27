'use client';

import { RotateCcw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { AmountInput } from '@/features/budget/components/amount-input';
import { BIOMETRICS_FAMILY_CAP, type EditableLine, type LineSource } from '@/features/budget/data/fees';
import { useFormatMoney } from '@/features/budget/hooks/use-format-money';
import { convert, type BudgetEstimate, type BudgetLine, type Rates } from '@/features/budget/lib/estimate-budget';
import { LONG_DAY, noonUtc } from '@/features/budget/lib/day';

/** « Source : IRCC · vérifié le 30 avril 2026 », the source linked when it has a page. */
export function SourceNote({ source, checkedOn, message }: { source: LineSource; checkedOn: string; message: 'source' | 'fundsSource' }): ReactNode {
  const t = useTranslations('Budget.estimator');
  const format = useFormatter();
  const date = format.dateTime(noonUtc(checkedOn), LONG_DAY);
  return (
    <p className="mt-1 text-caption text-slate">
      {t.rich(message, {
        source: source.name,
        date,
        src: (chunks) =>
          source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-navy-deep underline underline-offset-2">
              {chunks}
            </a>
          ) : (
            chunks
          ),
      })}
    </p>
  );
}

function FeeRow({
  line,
  rates,
  onPrice,
  onReset,
  edited,
}: {
  line: BudgetLine;
  rates: Rates;
  onPrice: (key: EditableLine, amount: number) => void;
  onReset: (key: EditableLine) => void;
  edited: boolean;
}): ReactNode {
  const t = useTranslations('Budget');
  const money = useFormatMoney();
  const id = useId();
  const label = t(`lines.${line.labelKey}`);
  const unit = Math.round(convert(line.unitAmount, line.unitCurrency, line.currency, rates));
  const capped = line.key === 'biometrics' && line.unitAmount * line.count > BIOMETRICS_FAMILY_CAP;

  return (
    <li aria-labelledby={`${id}-label`} className="border-b border-fog-light py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span id={`${id}-label`} className="font-heading text-body font-bold text-navy-deep">
              {label}
            </span>
            {!line.editable && (
              <span className="rounded-full bg-ice-blue px-2 py-0.5 font-label uppercase tracking-wider text-navy-deep">
                {t('estimator.official')}
              </span>
            )}
          </p>
          <p className="mt-1 text-body-sm text-slate">
            {capped ? t('estimator.familyCap') : t('estimator.times', { count: line.count, unit: money(unit, line.currency, true) })}
          </p>
          <SourceNote source={line.source} checkedOn={line.checkedOn} message="source" />
        </div>
        <p className="shrink-0 font-heading text-body font-bold text-navy-deep">{money(line.amount, line.currency, true)}</p>
      </div>
      {line.editable && (
        <div className="mt-3 flex items-end gap-2">
          <AmountInput
            className="max-w-xs flex-1"
            label={t('estimator.price', { line: label, currency: line.currency })}
            value={unit}
            onChange={(amount) => onPrice(line.key as EditableLine, amount)}
          />
          {edited && (
            <button
              type="button"
              onClick={() => onReset(line.key as EditableLine)}
              aria-label={t('estimator.resetLine', { line: label })}
              title={t('estimator.resetLine', { line: label })}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-fog bg-white text-navy-deep hover:border-slate-mute"
            >
              <RotateCcw aria-hidden={true} className="size-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** « Frais à payer »: one row per line that counts, and their total. */
export function FeeList({
  estimate,
  rates,
  editedLines,
  onPrice,
  onReset,
}: {
  estimate: BudgetEstimate;
  rates: Rates;
  editedLines: ReadonlySet<EditableLine>;
  onPrice: (key: EditableLine, amount: number) => void;
  onReset: (key: EditableLine) => void;
}): ReactNode {
  const t = useTranslations('Budget.estimator');
  const money = useFormatMoney();
  return (
    <section aria-labelledby="budget-fees-title" className="rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <h2 id="budget-fees-title" className="font-heading text-h4 font-bold text-navy-deep">
        {t('fees')}
      </h2>
      <p className="mt-1 text-body-sm text-slate">{t('feesLead')}</p>
      <ul className="mt-2">
        {estimate.fees.map((line) => (
          <FeeRow
            key={line.key}
            line={line}
            rates={rates}
            edited={editedLines.has(line.key as EditableLine)}
            onPrice={onPrice}
            onReset={onReset}
          />
        ))}
      </ul>
      <div
        data-testid="fees-total"
        className="mt-2 flex items-baseline justify-between gap-4 rounded-xl bg-navy-deep px-5 py-4 text-white"
      >
        <span className="font-heading text-body font-bold">{t('feesTotal')}</span>
        <span className="font-heading text-h4 font-bold">{money(estimate.feesTotal, estimate.currency, true)}</span>
      </div>
    </section>
  );
}
