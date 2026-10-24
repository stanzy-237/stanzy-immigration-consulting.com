'use client';

import { Info, RotateCcw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { ClbConverterDialog } from '@/features/fsw/components/clb-converter-dialog';
import { FswResult } from '@/features/fsw/components/fsw-result';
import { ReuseCrsMenu } from '@/features/fsw/components/reuse-crs-menu';
import {
  ADAPTABILITY_MAX,
  ADAPTABILITY_POINTS,
  AGE_MAX,
  ARRANGED_EMPLOYMENT_POINTS,
  EDUCATION_MAX,
  FSW_CRITERIA_DATE,
  LANGUAGE_MAX,
  WORK_MAX,
} from '@/features/fsw/data/fsw-criteria';
import { assessFsw } from '@/features/fsw/lib/assess-fsw';
import {
  DEFAULT_FSW_FORM,
  fromCrsAnswers,
  fswFormSchema,
  LEVEL_CHOICES,
  LMIA_SITUATIONS,
  toProfile,
  WORK_CHOICES,
  type FswForm,
  type LevelChoice,
} from '@/features/fsw/lib/fsw-form';
import {
  CalculatorSection,
  CheckField,
  NumberField,
  SelectField,
} from '@/features/shared/components/calculator-fields';
import { FamilyFields } from '@/features/shared/components/family-fields';
import { PhoneScoreBar } from '@/features/shared/components/phone-score-bar';
import { RulesChoice } from '@/features/shared/components/rules-choice';
import { EDUCATION_LEVELS } from '@/features/shared/data/education-levels';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { ABILITIES } from '@/features/shared/lib/language-levels';
import { isPartnered } from '@/features/shared/lib/marital-status';
import { rulesInForceOn, type RulesVersion } from '@/features/shared/lib/rules-version';
import { track } from '@/lib/analytics';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const FSW_DRAFT_KEY = 'stanzy.fsw.draft.v1';

/** Adaptability items the visitor ticks, with their points from IRCC's grid. */
const OWN_ITEMS = [
  ['studiedInCanada', 'studiedInCanada', ADAPTABILITY_POINTS.studiedInCanada],
  ['workedInCanada', 'workedInCanada', ADAPTABILITY_POINTS.workedInCanada],
  ['relativeInCanada', 'relativeInCanada', ADAPTABILITY_POINTS.relativeInCanada],
] as const;
const SPOUSE_ITEMS = [
  ['spouseLanguageClb4', 'spouseLanguage', ADAPTABILITY_POINTS.spouseLanguage],
  ['spouseStudiedInCanada', 'spouseStudiedInCanada', ADAPTABILITY_POINTS.spouseStudiedInCanada],
  ['spouseWorkedInCanada', 'spouseWorkedInCanada', ADAPTABILITY_POINTS.spouseWorkedInCanada],
] as const;

/**
 * The Calculateur 67 points: the six Federal Skilled Worker factors, scored
 * by the engine as the visitor answers, with the verdict in a sticky card.
 * `today` decides which rules apply; before 2026-11-03 the visitor can
 * preview the upcoming ones.
 */
export function FswCalculator({ today = new Date() }: { today?: Date }): ReactNode {
  const t = useTranslations('Fsw');
  const tLanguage = useTranslations('Calculators.language');
  const format = useFormatter();
  const [form, setForm] = useStoredForm(FSW_DRAFT_KEY, fswFormSchema, DEFAULT_FSW_FORM);
  const inForce = rulesInForceOn(today);
  const [rules, setRules] = useState<RulesVersion>(inForce);
  const [converting, setConverting] = useState(false);
  const [reusedCrs, setReusedCrs] = useState(false);

  const result = useMemo(() => assessFsw(toProfile(form), { rules }), [form, rules]);
  const assessment = result.ok ? result.assessment : null;
  const ageInvalid = !result.ok && result.issues.some((i) => i.field === 'age');
  const pts = (points: number | undefined, max: number): string =>
    t('points', { points: points ?? '—', max });

  const markStarted = useCalculatorTracking('fsw');
  const update = (next: FswForm): void => {
    markStarted();
    setForm(next);
  };
  const set = <K extends keyof FswForm>(key: K, value: FswForm[K]): void => update({ ...form, [key]: value });

  // Analytics: the verdict each time it changes. No answers are sent.
  const eligible = assessment?.eligible;
  useEffect(() => {
    if (eligible !== undefined) track('fsw.verdict', { eligible });
  }, [eligible]);

  const spouseCounts =
    isPartnered(form.maritalStatus) && form.spouseAccompanying && !form.spouseIsCanadianCitizenOrPR;
  const abilityName = (ability: (typeof ABILITIES)[number]): string =>
    tLanguage(`abilitiesByTestLanguage.${form.firstLanguageOfficial}.${ability}`);
  const step = (n: number): string => t('step', { n: String(n).padStart(2, '0') });
  // Current rules: the date of IRCC's pages; upcoming rules: the day they take effect.
  const criteriaDate = rules === inForce ? FSW_CRITERIA_DATE : rules;

  return (
    <div className="grid grid-cols-1 items-start gap-7 pb-20 lg:grid-cols-3 lg:pb-0">
      <PhoneScoreBar label={t('result.label')} score={assessment?.total ?? null} outOf="/ 100" />

      <div className="min-w-0 space-y-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-slate">
            {t('rulesNote', { date: format.dateTime(new Date(criteriaDate), { dateStyle: 'long', timeZone: 'UTC' }) })}
          </p>
          <ReuseCrsMenu
            onPick={(answers) => {
              update(fromCrsAnswers(answers, form));
              setReusedCrs(true);
            }}
          />
        </div>
        {reusedCrs ? (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-ice-blue p-4 text-body-sm text-navy-deep">
            <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-steel-blue" />
            {t('reusedNotice')}
          </p>
        ) : null}

        <RulesChoice name="fsw-rules" inForce={inForce} rules={rules} onChange={setRules} hint={t('rulesHint')} />

        <CalculatorSection
          id="fsw-language"
          step={step(1)}
          title={t('language.title')}
          subtitle={t('language.subtitle')}
          points={pts(assessment?.factors.language, LANGUAGE_MAX)}
        >
          <SelectField
            label={t('language.official')}
            value={form.firstLanguageOfficial}
            options={(['fr', 'en'] as const).map((l) => ({ value: l, label: t(`language.officialOptions.${l}`) }))}
            onChange={(v) => set('firstLanguageOfficial', v)}
          />
          <button
            type="button"
            onClick={() => setConverting(true)}
            className="inline-flex items-center gap-2 text-body-sm font-semibold text-rouge hover:underline"
          >
            <RotateCcw aria-hidden={true} className="size-4" />
            {t('language.converter')}
          </button>
          <div className="grid gap-4 sm:grid-cols-2">
            {ABILITIES.map((ability) => (
              <SelectField
                key={ability}
                label={abilityName(ability)}
                value={String(form.firstLevels[ability])}
                options={LEVEL_CHOICES.map((l) => ({ value: String(l), label: t(`language.levelOptions.${l}`) }))}
                onChange={(v) => set('firstLevels', { ...form.firstLevels, [ability]: Number(v) as LevelChoice })}
              />
            ))}
          </div>
          <fieldset className="border-t border-fog pt-5">
            <legend className="mb-3 text-body-sm font-semibold text-navy-deep">{t('language.second')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([false, true] as const).map((yes) => (
                <label
                  key={String(yes)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-fog px-4 py-3 text-body-sm font-medium text-navy-deep hover:border-rouge"
                >
                  <input
                    type="radio"
                    name="fsw-second-language"
                    checked={form.secondLanguage === yes}
                    onChange={() => set('secondLanguage', yes)}
                    className="size-4 accent-rouge"
                  />
                  {yes ? t('language.secondYes') : t('language.secondNo')}
                </label>
              ))}
            </div>
          </fieldset>
        </CalculatorSection>

        <div className="grid gap-5 md:grid-cols-2">
          <CalculatorSection
            id="fsw-education"
            step={step(2)}
            title={t('education.title')}
            points={pts(assessment?.factors.education, EDUCATION_MAX)}
          >
            <SelectField
              label={t('education.label')}
              value={form.education}
              options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.options.${e}`) }))}
              onChange={(v) => set('education', v)}
              hint={t('education.hint')}
            />
          </CalculatorSection>
          <CalculatorSection
            id="fsw-work"
            step={step(3)}
            title={t('work.title')}
            points={pts(assessment?.factors.work, WORK_MAX)}
          >
            <SelectField
              label={t('work.label')}
              value={String(form.skilledWorkYears)}
              options={WORK_CHOICES.map((y) => ({ value: String(y), label: t(`work.options.${y}`) }))}
              onChange={(v) => set('skilledWorkYears', Number(v) as FswForm['skilledWorkYears'])}
              hint={t('work.hint')}
            />
          </CalculatorSection>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <CalculatorSection id="fsw-age" step={step(4)} title={t('age.title')} points={pts(assessment?.factors.age, AGE_MAX)}>
            <NumberField
              label={t('age.label')}
              value={form.age}
              inputMode="numeric"
              onChange={(v) => set('age', v)}
              hint={t('age.hint')}
              error={ageInvalid ? t('age.invalid') : undefined}
            />
          </CalculatorSection>
          <CalculatorSection
            id="fsw-job-offer"
            step={step(5)}
            title={t('jobOffer.title')}
            points={pts(assessment?.factors.arrangedEmployment, ARRANGED_EMPLOYMENT_POINTS)}
          >
            <SelectField
              label={t('jobOffer.label')}
              value={form.jobOffer}
              options={(['none', 'valid'] as const).map((o) => ({ value: o, label: t(`jobOffer.${o}`) }))}
              onChange={(v) => set('jobOffer', v)}
            />
            {form.jobOffer === 'valid' && rules === '2025-03-25' ? (
              <SelectField
                label={t('jobOffer.situation')}
                value={form.lmiaSituation}
                options={LMIA_SITUATIONS.map((s) => ({ value: s, label: t(`jobOffer.situations.${s}`) }))}
                onChange={(v) => set('lmiaSituation', v)}
              />
            ) : null}
            {form.jobOffer === 'valid' && rules === '2026-11-03' ? (
              <p className="text-body-sm text-slate">{t('jobOffer.noLmia')}</p>
            ) : null}
          </CalculatorSection>
        </div>

        <CalculatorSection
          id="fsw-adaptability"
          step={step(6)}
          title={t('adaptability.title')}
          subtitle={t('adaptability.subtitle')}
          points={pts(assessment?.factors.adaptability, ADAPTABILITY_MAX)}
        >
          <FamilyFields value={form} onChange={(family) => update({ ...form, ...family })} />
          <div className="grid gap-3">
            {[...OWN_ITEMS, ...(spouseCounts ? SPOUSE_ITEMS : [])].map(([field, copy, points]) => (
              <CheckField
                key={field}
                label={t(`adaptability.items.${copy}`)}
                points={`+${points}`}
                checked={form[field]}
                onChange={(v) => set(field, v)}
              />
            ))}
            {assessment && assessment.factors.arrangedEmployment > 0 ? (
              <CheckField
                label={t('adaptability.items.arrangedEmployment')}
                points={`+${ADAPTABILITY_POINTS.arrangedEmployment}`}
                checked
                disabled
                onChange={() => undefined}
              />
            ) : null}
          </div>
        </CalculatorSection>
      </div>

      <div className="lg:sticky-below-nav">
        <FswResult assessment={assessment} onReset={() => update(DEFAULT_FSW_FORM)} />
      </div>

      {converting ? (
        <ClbConverterDialog
          onClose={() => setConverting(false)}
          onApply={({ official, levels }) => {
            update({ ...form, firstLanguageOfficial: official, firstLevels: levels });
            setConverting(false);
          }}
        />
      ) : null}
    </div>
  );
}
