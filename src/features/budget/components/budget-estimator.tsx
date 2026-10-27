'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { AmountInput } from '@/features/budget/components/amount-input';
import { FeeList } from '@/features/budget/components/fee-list';
import { FundsCard } from '@/features/budget/components/funds-card';
import { CURRENCIES, DEFAULT_RATES, RATES_CHECKED_ON, type Currency } from '@/features/budget/data/currencies';
import { EDITABLE_LINES, LANGUAGE_TESTS, type EditableLine } from '@/features/budget/data/fees';
import { useBudgetEstimate } from '@/features/budget/hooks/use-budget-estimate';
import type { BudgetAnswers } from '@/features/budget/lib/budget-schema';
import { estimateBudget, ratesFor } from '@/features/budget/lib/estimate-budget';
import { LONG_DAY, noonUtc } from '@/features/budget/lib/day';
import { CalculatorSection, CheckField, SelectField } from '@/features/shared/components/calculator-fields';
import { api } from '@/trpc/react';

const CHILDREN = Array.from({ length: 11 }, (_, n) => n);
const TEST_NAMES: Record<(typeof LANGUAGE_TESTS)[number], string> = {
  TEF: 'TEF Canada',
  TCF: 'TCF Canada',
  IELTS: 'IELTS General Training',
  CELPIP: 'CELPIP General',
};

/**
 * « Estimer mon budget »: the family's answers on one side, the fees and the
 * proof of funds on the other. Free and without an account; a signed-in User
 * can also save it to their Account.
 */
export function BudgetEstimator(): ReactNode {
  const t = useTranslations('Budget');
  const format = useFormatter();
  const { account } = useCurrentAccount();
  const profile = api.budget.profile.get.useQuery(undefined, { enabled: account !== null });
  const save = api.budget.profile.saveEstimate.useMutation();
  const utils = api.useUtils();
  const [answers, setAnswers] = useBudgetEstimate(account ? profile.data?.estimate : null);

  const rates = useMemo(() => ratesFor(answers), [answers]);
  const estimate = useMemo(() => estimateBudget(answers, rates), [answers, rates]);
  const edited = useMemo(
    () => new Set(EDITABLE_LINES.filter((key) => answers.lines[key] !== undefined)),
    [answers.lines],
  );

  const update = (patch: Partial<BudgetAnswers>) => {
    save.reset();
    setAnswers({ ...answers, ...patch });
  };
  const setPrice = (key: EditableLine, amount: number) =>
    update({ lines: { ...answers.lines, [key]: { amount, currency: answers.currency } } });
  const resetPrice = (key: EditableLine) => {
    const lines = { ...answers.lines };
    delete lines[key];
    update({ lines });
  };
  const saveToAccount = () =>
    save.mutate({ estimate: answers }, { onSuccess: () => void utils.budget.profile.get.invalidate() });

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:sticky lg:top-20">
        <CalculatorSection id="budget-family" title={t('estimator.family')} accent="steel">
          <CheckField label={t('estimator.spouse')} checked={answers.spouse} onChange={(spouse) => update({ spouse })} />
          <SelectField
            label={t('estimator.children')}
            value={String(answers.children)}
            options={CHILDREN.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(children) => update({ children: Number(children) })}
          />
          <CheckField
            label={t('estimator.fundsExempt')}
            checked={answers.fundsExempt}
            onChange={(fundsExempt) => update({ fundsExempt })}
          />
        </CalculatorSection>

        <CalculatorSection id="budget-tests" title={t('estimator.tests')} accent="rouge">
          <SelectField
            label={t('estimator.test')}
            value={answers.test}
            options={[
              ...LANGUAGE_TESTS.map((test) => ({ value: test, label: TEST_NAMES[test] })),
              { value: 'none' as const, label: t('estimator.testDone') },
            ]}
            onChange={(test) => update({ test })}
          />
          {answers.spouse && (
            <CheckField
              label={t('estimator.spouseTest')}
              checked={answers.spouseTest}
              onChange={(spouseTest) => update({ spouseTest })}
            />
          )}
          <CheckField
            label={t('estimator.ecaPrincipal')}
            checked={answers.ecaPrincipal}
            onChange={(ecaPrincipal) => update({ ecaPrincipal })}
          />
          {answers.spouse && (
            <CheckField
              label={t('estimator.ecaSpouse')}
              checked={answers.ecaSpouse}
              onChange={(ecaSpouse) => update({ ecaSpouse })}
            />
          )}
        </CalculatorSection>

        <CalculatorSection id="budget-currency" title={t('estimator.currencySection')} accent="navy">
          <SelectField<Currency>
            label={t('estimator.currency')}
            value={answers.currency}
            options={CURRENCIES.map((code) => ({ value: code, label: t(`currencies.${code}`) }))}
            // A new currency starts from its own default rate.
            onChange={(currency) => update({ currency, rate: null })}
          />
          {answers.currency !== 'CAD' && (
            <div>
              <AmountInput
                key={answers.currency}
                label={t('estimator.rate', { currency: answers.currency })}
                value={rates[answers.currency]}
                onChange={(rate) => {
                  if (rate > 0) update({ rate });
                }}
                hint={t('estimator.rateHint', {
                  date: format.dateTime(noonUtc(RATES_CHECKED_ON), LONG_DAY),
                })}
              />
              {answers.rate !== null && answers.rate !== DEFAULT_RATES[answers.currency] && (
                <button
                  type="button"
                  onClick={() => update({ rate: null })}
                  className="mt-2 text-caption font-semibold text-rouge"
                >
                  {t('estimator.rateReset')}
                </button>
              )}
            </div>
          )}
        </CalculatorSection>

        {account ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={saveToAccount}
              disabled={save.isPending}
              className="h-12 w-full rounded-2xl bg-rouge font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-60"
            >
              {t('estimator.save')}
            </button>
            <p role="status" className="text-center text-body-sm text-slate">
              {save.isSuccess ? t('estimator.saved') : save.isError ? t('estimator.saveError') : null}
            </p>
          </div>
        ) : (
          <p className="text-center text-body-sm text-slate">{t('estimator.keptHere')}</p>
        )}
      </div>

      <div className="min-w-0 space-y-6 lg:col-span-2">
        <FeeList estimate={estimate} rates={rates} editedLines={edited} onPrice={setPrice} onReset={resetPrice} />
        <FundsCard estimate={estimate} />
      </div>
    </div>
  );
}
