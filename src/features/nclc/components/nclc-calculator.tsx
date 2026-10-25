'use client';

import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { NclcResult } from '@/features/nclc/components/nclc-result';
import { assessLanguageTest } from '@/features/nclc/lib/assess-language-test';
import { DEFAULT_NCLC_FORM, NCLC_TESTS, nclcFormSchema, SCORE_ORDER } from '@/features/nclc/lib/nclc-form';
import { CalculatorSection, NumberField, SelectField } from '@/features/shared/components/calculator-fields';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { toLanguageResult } from '@/features/shared/lib/language-form';

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
    const input = toLanguageResult(form);
    return input ? assessLanguageTest(input) : null;
  }, [form]);
  const invalid = result && !result.ok ? result.invalid : [];

  const update = (next: typeof form) => {
    markStarted();
    setForm(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <CalculatorSection id="nclc-form" title={t('form.title')} accent="rouge">
        <div className="space-y-5">
          <SelectField
            label={t('testLabel')}
            value={form.test}
            options={NCLC_TESTS.map((test) => ({ value: test, label: tLanguage(`tests.${test}`) }))}
            onChange={(test) => update({ ...form, test })}
            hint={t(`testHints.${form.test}`)}
          />
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
        </div>
      </CalculatorSection>

      {/* Announced as it changes, like the CRS and 67 points results. */}
      <div role="status" className="lg:sticky-below-nav">
        {result?.ok ? (
          <NclcResult test={form.test} assessment={result.assessment} />
        ) : (
          <p className="rounded-2xl border border-dashed border-fog bg-white p-6 text-body-sm text-slate">{t('result.empty')}</p>
        )}
      </div>
    </div>
  );
}
