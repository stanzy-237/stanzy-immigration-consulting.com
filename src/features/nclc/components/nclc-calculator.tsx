'use client';

import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { NclcLegend, NclcResult } from '@/features/nclc/components/nclc-result';
import { assessLanguageTest } from '@/features/nclc/lib/assess-language-test';
import { DEFAULT_NCLC_FORM, NCLC_TESTS, nclcFormSchema, SCORE_ORDER } from '@/features/nclc/lib/nclc-form';
import { NumberField, SelectField } from '@/features/shared/components/calculator-fields';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { cn } from '@/lib/utils';
import { toLanguageResult } from '@/features/shared/lib/language-form';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const NCLC_DRAFT_KEY = 'stanzy.nclc.draft.v1';

/** A step's card from `lg`, styled like CalculatorSection; plain inside the phone card. */
const STEP_CARD =
  'relative lg:overflow-hidden lg:rounded-2xl lg:border lg:border-fog lg:bg-white lg:p-6 lg:shadow-sm';

/** The step label and title, shown from `lg` only. */
function StepHeading({ step, title, subtitle }: { step: string; title: string; subtitle?: string }): ReactNode {
  return (
    <div className="mb-5 hidden lg:block">
      <p className="mb-2 font-label text-rouge">{step}</p>
      <h3 className="font-heading text-h4 font-bold text-navy-deep">{title}</h3>
      {subtitle ? <p className="mt-1 text-body-sm text-slate">{subtitle}</p> : null}
    </div>
  );
}

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
    // Phones read the form then the result; from `lg` the result sits sticky
    // on the right, beside the form and the legend.
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* One card on phones; from `lg`, two step cards like the other calculators. */}
      <section
        aria-labelledby="nclc-form-title"
        className="relative overflow-hidden rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6 lg:col-start-1 lg:flex lg:flex-col lg:gap-6 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
      >
        <div aria-hidden={true} className="absolute inset-x-0 top-0 h-1 bg-rouge lg:hidden" />
        <h2 id="nclc-form-title" className="mb-5 font-heading text-h4 font-bold text-navy-deep lg:sr-only">
          {t('form.title')}
        </h2>
        <div className={STEP_CARD}>
          <div aria-hidden={true} className="absolute inset-x-0 top-0 hidden h-1 bg-rouge lg:block" />
          <StepHeading step={t('steps.test.step')} title={t('steps.test.title')} />
          <SelectField
            label={t('testLabel')}
            value={form.test}
            options={NCLC_TESTS.map((test) => ({ value: test, label: tLanguage(`tests.${test}`) }))}
            onChange={(test) => update({ ...form, test })}
            hint={t(`testHints.${form.test}`)}
          />
        </div>
        <div className={cn(STEP_CARD, 'mt-5 lg:mt-0')}>
          <StepHeading step={t('steps.scores.step')} title={t('steps.scores.title')} subtitle={t('steps.scores.subtitle')} />
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
      </section>

      {/* Announced as it changes, like the CRS and 67 points results. */}
      <div role="status" className="lg:sticky-below-nav lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {result?.ok ? (
          <NclcResult test={form.test} scores={form.scores} assessment={result.assessment} />
        ) : (
          <p className="rounded-2xl border border-dashed border-fog bg-white p-6 text-body-sm text-slate">{t('result.empty')}</p>
        )}
      </div>

      {/* Desktop only: phones keep the short version. */}
      <div className="hidden lg:col-start-1 lg:block">
        <NclcLegend />
      </div>
    </div>
  );
}
