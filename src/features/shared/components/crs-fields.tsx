'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { HIGH_WAGE_LEVELS } from '@/features/crs/data/crs-criteria';
import type { CrsResult } from '@/features/crs/lib/compute-crs';
import type { CrsForm } from '@/features/crs/lib/crs-form';
import {
  CalculatorSection,
  CheckField,
  NumberField,
  SelectField,
} from '@/features/shared/components/calculator-fields';
import { FamilyFields } from '@/features/shared/components/family-fields';
import { LanguageFields } from '@/features/shared/components/language-fields';
import { EDUCATION_LEVELS } from '@/features/shared/data/education-levels';
import { emptyLanguage } from '@/features/shared/lib/language-form';
import { isPartnered } from '@/features/shared/lib/marital-status';
import type { RulesVersion } from '@/features/shared/lib/rules-version';

const CANADIAN_YEARS = [0, 1, 2, 3, 4, 5] as const;
/** 0 = none, 1 = 1 to 2 years, 3 = 3 years or more (the transferability rows). */
const FOREIGN_YEARS = [0, 1, 3] as const;
const STUDY = ['none', 'oneOrTwoYears', 'threePlusYears'] as const;
/** Message keys can't contain dots, so wage levels map to their own keys. */
const HIGH_WAGE_KEY = { none: 'none', '1.3x': 'x1_3', '1.5x': 'x1_5', '2x': 'x2' } as const;

/**
 * The Calculateur CRS's questions, each section with the points it earns
 * under `rules`: for the calculator, and for the Demande d'intérêt's CRS
 * step (#81).
 */
export function CrsFields({
  form,
  onChange,
  rules,
  result,
}: {
  form: CrsForm;
  onChange: (form: CrsForm) => void;
  rules: RulesVersion;
  result: CrsResult;
}): ReactNode {
  const t = useTranslations('Crs');
  const tLanguage = useTranslations('Calculators.language');
  const breakdown = result.ok ? result.breakdown : null;
  const issueFor = (field: string): boolean => !result.ok && result.issues.some((i) => i.field === field);
  const pts = (points: number | undefined): string =>
    points === undefined ? '—' : t('points', { points });
  const update = onChange;
  const set = <K extends keyof CrsForm>(key: K, value: CrsForm[K]): void => update({ ...form, [key]: value });
  const partnered = isPartnered(form.maritalStatus);
  const spouseCounts = partnered && form.spouseAccompanying && !form.spouseIsCanadianCitizenOrPR;
  const yearsOptions = (years: readonly number[], key: 'years' | 'foreignYears') =>
    years.map((y) => ({ value: String(y), label: t(`work.${key}`, { years: y }) }));

  return (
    <>
    <CalculatorSection id="family" title={t('sections.family')} accent="steel">
      <FamilyFields value={form} onChange={(family) => update({ ...form, ...family })} note={t('family.note')} />
    </CalculatorSection>

    <CalculatorSection id="age" title={t('sections.age')} points={pts(breakdown?.core.age)} accent="rouge">
      <NumberField
        label={t('age.label')}
        value={form.age}
        inputMode="numeric"
        onChange={(age) => set('age', age)}
        hint={t('age.hint')}
        error={issueFor('age') ? t('age.invalid') : undefined}
      />
    </CalculatorSection>

    <CalculatorSection id="education" title={t('sections.education')} points={pts(breakdown?.core.education)} accent="navy">
      <SelectField
        label={t('education.label')}
        value={form.education}
        options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.options.${e}`) }))}
        onChange={(education) => set('education', education)}
        hint={t('education.hint')}
      />
    </CalculatorSection>

    <CalculatorSection id="first-language" title={t('sections.firstLanguage')} points={pts(breakdown?.core.firstLanguage)} accent="steel">
      <LanguageFields slot="firstLanguage" value={form.firstLanguage} onChange={(v) => set('firstLanguage', v)} />
      <button
        type="button"
        onClick={() => set('secondLanguage', form.secondLanguage ? null : emptyLanguage())}
        className="rounded-full border border-fog bg-ice-blue px-4 py-2 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-fog"
      >
        {form.secondLanguage ? tLanguage('removeSecond') : tLanguage('addSecond')}
      </button>
    </CalculatorSection>

    {form.secondLanguage ? (
      <CalculatorSection id="second-language" title={t('sections.secondLanguage')} points={pts(breakdown?.core.secondLanguage)} accent="steel">
        <LanguageFields
          slot="secondLanguage"
          value={form.secondLanguage}
          onChange={(v) => set('secondLanguage', v)}
          error={issueFor('secondLanguage') ? tLanguage('sameLanguage') : undefined}
        />
      </CalculatorSection>
    ) : null}

    <CalculatorSection id="work" title={t('sections.work')} points={pts(breakdown?.core.canadianWork)} accent="navy">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('work.canadian')}
          value={String(form.canadianWorkYears)}
          options={yearsOptions(CANADIAN_YEARS, 'years')}
          onChange={(v) => set('canadianWorkYears', Number(v))}
        />
        <SelectField
          label={t('work.foreign')}
          value={String(form.foreignWorkYears)}
          options={yearsOptions(FOREIGN_YEARS, 'foreignYears')}
          onChange={(v) => set('foreignWorkYears', Number(v))}
        />
      </div>
      {rules === '2026-11-03' ? (
        <>
          <SelectField
            label={t('work.highWageWork')}
            value={form.highWageWork}
            options={HIGH_WAGE_LEVELS.map((l) => ({ value: l, label: t(`work.highWageOptions.${HIGH_WAGE_KEY[l]}`) }))}
            onChange={(v) => set('highWageWork', v)}
            hint={t('work.highWageHint')}
          />
          <SelectField
            label={t('work.highWageJobOffer')}
            value={form.highWageJobOffer}
            options={HIGH_WAGE_LEVELS.map((l) => ({ value: l, label: t(`work.highWageOptions.${HIGH_WAGE_KEY[l]}`) }))}
            onChange={(v) => set('highWageJobOffer', v)}
          />
          {breakdown?.core.labourMarketIntegration ? (
            <p className="text-body-sm font-semibold text-navy-deep">
              {t('work.labourMarket', { points: breakdown.core.labourMarketIntegration.total })}
            </p>
          ) : null}
        </>
      ) : null}
      <CheckField
        label={t('work.certificate')}
        checked={form.certificateOfQualification}
        onChange={(v) => set('certificateOfQualification', v)}
      />
    </CalculatorSection>

    <CalculatorSection id="additional" title={t('sections.additional')} points={pts(breakdown?.additional.total)} accent="rouge">
      <CheckField
        label={t('additional.nomination')}
        points="+600"
        checked={form.provincialNomination}
        onChange={(v) => set('provincialNomination', v)}
      />
      <CheckField
        label={t('additional.sibling')}
        points="+15"
        checked={form.siblingInCanada}
        onChange={(v) => set('siblingInCanada', v)}
      />
      <SelectField
        label={t('additional.study')}
        value={form.canadianStudy}
        options={STUDY.map((s) => ({ value: s, label: t(`additional.studyOptions.${s}`) }))}
        onChange={(v) => set('canadianStudy', v)}
      />
      {breakdown && breakdown.additional.french > 0 ? (
        <p className="text-body-sm font-semibold text-navy-deep">
          {t('additional.french', { points: breakdown.additional.french })}
        </p>
      ) : null}
      {rules === '2025-03-25' ? <p className="text-body-sm text-slate">{t('additional.jobOfferNote')}</p> : null}
    </CalculatorSection>

    {spouseCounts ? (
      <CalculatorSection id="spouse" title={t('sections.spouse')} points={pts(breakdown?.spouse.total)} accent="rouge">
        <SelectField
          label={t('spouse.education')}
          value={form.spouseEducation}
          options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.options.${e}`) }))}
          onChange={(v) => set('spouseEducation', v)}
        />
        <SelectField
          label={t('spouse.canadianWork')}
          value={String(form.spouseCanadianWorkYears)}
          options={yearsOptions(CANADIAN_YEARS, 'years')}
          onChange={(v) => set('spouseCanadianWorkYears', Number(v))}
        />
        <LanguageFields slot="spouse" value={form.spouseLanguage} onChange={(v) => set('spouseLanguage', v)} />
      </CalculatorSection>
    ) : null}
    </>
  );
}
