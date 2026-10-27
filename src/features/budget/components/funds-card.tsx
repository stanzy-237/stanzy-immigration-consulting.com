'use client';

import { PiggyBank } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { FUNDS_CHECKED_ON, FUNDS_SOURCE } from '@/features/budget/data/fees';
import { SourceNote } from '@/features/budget/components/fee-list';
import { useFormatMoney } from '@/features/budget/hooks/use-format-money';
import type { BudgetEstimate } from '@/features/budget/lib/estimate-budget';

/**
 * « Fonds à prouver »: IRCC's settlement funds for the family, kept apart from
 * the fees because it is money the family keeps.
 */
export function FundsCard({ estimate }: { estimate: BudgetEstimate }): ReactNode {
  const t = useTranslations('Budget.estimator');
  const money = useFormatMoney();
  const funds = estimate.fundsToProve;
  return (
    <section aria-labelledby="budget-funds-title" className="rounded-2xl border-2 border-dashed border-steel-blue bg-ice-blue p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden={true} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-navy-deep">
          <PiggyBank className="size-5" />
        </span>
        <h2 id="budget-funds-title" className="font-heading text-h4 font-bold text-navy-deep">
          {t('funds')}
        </h2>
      </div>
      {funds === 'exempt' ? (
        <p className="mt-4 text-body text-navy-deep">{t('fundsExemptText')}</p>
      ) : (
        <>
          <p className="mt-4 font-heading text-h3 font-bold text-navy-deep">{money(funds.amount, estimate.currency, true)}</p>
          <p className="mt-1 text-body-sm font-semibold text-navy-deep">
            {t('fundsFor', { persons: funds.persons })}
            {estimate.currency === 'CAD' ? null : ` · ${t('fundsInCad', { cad: money(funds.cad, 'CAD', true) })}`}
          </p>
          <p className="mt-3 text-body-sm text-slate">{t('fundsNote')}</p>
          <SourceNote source={FUNDS_SOURCE} checkedOn={FUNDS_CHECKED_ON} message="fundsSource" />
        </>
      )}
    </section>
  );
}
