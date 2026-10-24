'use client';

import { RotateCcw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useStoredDraft } from '@/features/crs/hooks/use-crs-draft';
import { ClbConverterDialog } from '@/features/fsw/components/clb-converter-dialog';
import { FswResult } from '@/features/fsw/components/fsw-result';
import {
  ADAPTABILITY_MAX,
  AGE_MAX,
  ARRANGED_EMPLOYMENT_POINTS,
  EDUCATION_MAX,
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
import { EDUCATION_LEVELS } from '@/features/shared/data/education-levels';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { ABILITIES } from '@/features/shared/lib/language-levels';
import { isPartnered, MARITAL_STATUSES } from '@/features/shared/lib/marital-status';
import { rulesInForceOn, type RulesVersion } from '@/features/shared/lib/rules-version';
import { track } from '@/lib/analytics';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const FSW_DRAFT_KEY = 'stanzy.fsw.draft.v1';

type AdaptabilityItem =
  | 'studiedInCanada'
  | 'workedInCanada'
  | 'relativeInCanada'
  | 'spouseLanguageClb4'
  | 'spouseStudiedInCanada'
  | 'spouseWorkedInCanada';

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
  const crsAnswers = useStoredDraft();
  const inForce = rulesInForceOn(today);
  const [rules, setRules] = useState<RulesVersion>(inForce);
  const [converting, setConverting] = useState(false);

  const result = useMemo(() => assessFsw(toProfile(form), { rules }), [form, rules]);
  const assessment = result.ok ? result.assessment : null;
  const ageInvalid = !result.ok && result.issues.some((i) => i.field === 'age');
  const pts = (points: number | undefined, max: number): string =>
    t('points', { points: points ?? '—', max });

  // Analytics: one event per visit, one on the first answer. No answers are sent.
  const started = useRef(false);
  useEffect(() => track('fsw.viewed'), []);
  const update = (next: FswForm): void => {
    if (!started.current) {
      started.current = true;
      track('fsw.started');
    }
    setForm(next);
  };
  const set = <K extends keyof FswForm>(key: K, value: FswForm[K]): void => update({ ...form, [key]: value });

  const spouseCounts =
    isPartnered(form.maritalStatus) && form.spouseAccompanying && !form.spouseIsCanadianCitizenOrPR;
  const abilityName = (ability: (typeof ABILITIES)[number]): string =>
    tLanguage(`abilitiesByTestLanguage.${form.firstLanguageOfficial}.${ability}`);
  const step = (n: number): string => t('step', { n: String(n).padStart(2, '0') });
  const ownItems: AdaptabilityItem[] = ['studiedInCanada', 'workedInCanada', 'relativeInCanada'];
  const spouseItems: AdaptabilityItem[] = ['spouseLanguageClb4', 'spouseStudiedInCanada', 'spouseWorkedInCanada'];
  const itemKey = (item: AdaptabilityItem): string => (item === 'spouseLanguageClb4' ? 'spouseLanguage' : item);

  return (
    <div className="grid grid-cols-1 items-start gap-7 pb-20 lg:grid-cols-3 lg:pb-0">
      {/* Phones: the score stays in view while scrolling; the announced one is in the result card. */}
      <div
        aria-hidden={true}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-white/10 bg-navy-deep px-5 py-3 text-white shadow-lg lg:hidden"
      >
        <span className="font-label text-white/60">{t('result.label')}</span>
        <span className="font-heading text-h3 font-bold">
          {assessment?.total ?? '—'}
          <span className="ml-1 text-body-sm font-normal text-white/60">/ 100</span>
        </span>
      </div>

      <div className="min-w-0 space-y-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-slate">
            {t('rulesNote', { date: format.dateTime(new Date(rules), { dateStyle: 'long', timeZone: 'UTC' }) })}
          </p>
          {crsAnswers ? (
            <button
              type="button"
              onClick={() => update(fromCrsAnswers(crsAnswers, form))}
              className="inline-flex items-center gap-2 rounded-full border border-fog bg-white px-4 py-2 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
            >
              <RotateCcw aria-hidden={true} className="size-4 text-rouge" />
              {t('reuseCrs')}
            </button>
          ) : null}
        </div>

        {inForce === '2025-03-25' ? (
          <fieldset className="rounded-2xl border border-fog bg-white p-4">
            <legend className="px-1 font-label text-slate">{t('rulesChoice.legend')}</legend>
            <div className="flex flex-wrap gap-4">
              {(['2025-03-25', '2026-11-03'] as const).map((version) => (
                <label key={version} className="flex items-center gap-2 text-body-sm font-semibold text-navy-deep">
                  <input
                    type="radio"
                    name="fsw-rules"
                    value={version}
                    checked={rules === version}
                    onChange={() => setRules(version)}
                    className="accent-rouge"
                  />
                  {version === '2025-03-25' ? t('rulesChoice.current') : t('rulesChoice.upcoming')}
                </label>
              ))}
            </div>
            <p className="mt-2 text-body-sm text-slate">{t('rulesChoice.hint')}</p>
          </fieldset>
        ) : null}

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
          <SelectField
            label={t('adaptability.marital')}
            value={form.maritalStatus}
            options={MARITAL_STATUSES.map((m) => ({ value: m, label: t(`adaptability.maritalOptions.${m}`) }))}
            onChange={(v) => set('maritalStatus', v)}
          />
          {isPartnered(form.maritalStatus) ? (
            <>
              <SelectField
                label={t('adaptability.accompanying')}
                value={form.spouseAccompanying ? 'yes' : 'no'}
                options={[
                  { value: 'no', label: t('adaptability.accompanyingNo') },
                  { value: 'yes', label: t('adaptability.accompanyingYes') },
                ]}
                onChange={(v) => set('spouseAccompanying', v === 'yes')}
              />
              <CheckField
                label={t('adaptability.citizenOrPR')}
                checked={form.spouseIsCanadianCitizenOrPR}
                onChange={(v) => set('spouseIsCanadianCitizenOrPR', v)}
              />
            </>
          ) : null}
          <div className="grid gap-3">
            {[...ownItems, ...(spouseCounts ? spouseItems : [])].map((item) => (
              <CheckField
                key={item}
                label={t(`adaptability.items.${itemKey(item)}`)}
                points={`+${item === 'workedInCanada' ? 10 : 5}`}
                checked={form[item]}
                onChange={(v) => set(item, v)}
              />
            ))}
            {assessment && assessment.factors.arrangedEmployment > 0 ? (
              <p className="text-body-sm font-semibold text-navy-deep">{t('adaptability.items.arrangedEmployment')} +5</p>
            ) : null}
          </div>
        </CalculatorSection>
      </div>

      <div className="lg:sticky-below-nav">
        <FswResult
          assessment={assessment}
          onReset={() => update(DEFAULT_FSW_FORM)}
        />
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
