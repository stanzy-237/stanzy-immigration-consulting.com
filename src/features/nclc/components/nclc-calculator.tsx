'use client';

import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { NclcLegend, NclcResult } from '@/features/nclc/components/nclc-result';
import { assessLanguageTest } from '@/features/nclc/lib/assess-language-test';
import { DEFAULT_NCLC_FORM, NCLC_TESTS, nclcFormSchema, SCORE_ORDER, toResult } from '@/features/nclc/lib/nclc-form';
import { CalculatorSection, NumberField, SelectField } from '@/features/shared/components/calculator-fields';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const NCLC_DRAFT_KEY = 'stanzy.nclc.draft.v1';

/**
 * The Calculateur NCLC / CLB: a test and its four results in, each skill's
 * level, indicative CRS points and program eligibility out, as the visitor types.
 */
export function NclcCalculator(): ReactNode {
  const t = useTranslations('Nclc');
  const tLanguage = useTranslations('Calculators.language');
  const [form, setForm] = useStoredForm(NCLC_DRAFT_KEY, nclcFormSchema, DEFAULT_NCLC_FORM);
  const markStarted = useCalculatorTracking('nclc');

  const spec = TEST_SPECS[form.test];
  const result = useMemo(() => {
    const input = toResult(form);
    return input ? assessLanguageTest(input) : null;
  }, [form]);
  const invalid = result && !result.ok ? result.invalid : [];

  const update = (next: typeof form) => {
    markStarted();
    setForm(next);
  };

  return (
    // Phones read form → result → legend; from `lg` the result sits sticky on
    // the right, beside the form and the legend.
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6 lg:col-start-1">
        <CalculatorSection id="nclc-test" step={t('steps.test.step')} title={t('steps.test.title')} accent="rouge">
          <SelectField
            label={t('testLabel')}
            value={form.test}
            options={NCLC_TESTS.map((test) => ({ value: test, label: tLanguage(`tests.${test}`) }))}
            onChange={(test) => update({ ...form, test })}
            hint={t(`testHints.${form.test}`)}
          />
        </CalculatorSection>

        <CalculatorSection
          id="nclc-scores"
          step={t('steps.scores.step')}
          title={t('steps.scores.title')}
          subtitle={t('steps.scores.subtitle')}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SCORE_ORDER.map((ability) => (
              <NumberField
                key={ability}
                label={t('scoreLabel', {
                  ability: tLanguage(`abilitiesByTestLanguage.${spec.language}.${ability}`),
                  max: spec.range[ability].max,
                })}
                value={form.scores[ability]}
                onChange={(value) => update({ ...form, scores: { ...form.scores, [ability]: value } })}
                error={invalid.includes(ability) ? tLanguage('invalid') : undefined}
              />
            ))}
          </div>
        </CalculatorSection>
      </div>

      <div className="lg:sticky-below-nav lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {result?.ok ? (
          <NclcResult test={form.test} scores={form.scores} assessment={result.assessment} />
        ) : (
          <p className="rounded-2xl border border-dashed border-fog bg-white p-6 text-body-sm text-slate">{t('result.empty')}</p>
        )}
      </div>

      <div className="lg:col-start-1">
        <NclcLegend />
      </div>
    </div>
  );
}
