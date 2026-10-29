'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { SaveSimulationDialog } from '@/features/crs/components/save-simulation-dialog';
import { SavedSimulations, SavedSimulationsSkeleton } from '@/features/crs/components/saved-simulations';
import { ScoreAdvice } from '@/features/crs/components/score-advice';
import { ScoreSummary } from '@/features/crs/components/score-summary';
import { HIGH_WAGE_LEVELS } from '@/features/crs/data/crs-criteria';
import { useCrsDraft } from '@/features/crs/hooks/use-crs-draft';
import { computeCrs, type CrsProfile } from '@/features/crs/lib/compute-crs';
import { DEFAULT_FORM, fromProfile, toProfile, type CrsForm } from '@/features/crs/lib/crs-form';
import {
  CalculatorSection,
  CheckField,
  NumberField,
  SelectField,
} from '@/features/shared/components/calculator-fields';
import { FamilyFields } from '@/features/shared/components/family-fields';
import { LanguageFields } from '@/features/shared/components/language-fields';
import { PhoneScoreBar } from '@/features/shared/components/phone-score-bar';
import { RulesChoice } from '@/features/shared/components/rules-choice';
import { EDUCATION_LEVELS } from '@/features/shared/data/education-levels';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { emptyLanguage } from '@/features/shared/lib/language-form';
import { isPartnered } from '@/features/shared/lib/marital-status';
import { rulesInForceOn, type RulesVersion } from '@/features/shared/lib/rules-version';
import { useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useTRPC } from '@/trpc/client';

const CANADIAN_YEARS = [0, 1, 2, 3, 4, 5] as const;
/** 0 = none, 1 = 1 to 2 years, 3 = 3 years or more (the transferability rows). */
const FOREIGN_YEARS = [0, 1, 3] as const;
const STUDY = ['none', 'oneOrTwoYears', 'threePlusYears'] as const;
/** Message keys can't contain dots, so wage levels map to their own keys. */
const HIGH_WAGE_KEY = { none: 'none', '1.3x': 'x1_3', '1.5x': 'x1_5', '2x': 'x2' } as const;

/**
 * The Calculateur CRS: the official questions, scored by the engine as the
 * visitor answers, with a result card that saves the simulation. `today`
 * decides which CRS rules apply; before 2026-11-03 the visitor can preview
 * the upcoming ones.
 */
export function CrsCalculator({ today = new Date() }: { today?: Date }): ReactNode {
  const t = useTranslations('Crs');
  const tSummary = useTranslations('Crs.summary');
  const tLanguage = useTranslations('Calculators.language');
  const format = useFormatter();
  const router = useRouter();
  const { account } = useCurrentAccount();
  const [form, setForm] = useCrsDraft();
  const inForce = rulesInForceOn(today);
  const [rules, setRules] = useState<RulesVersion>(inForce);
  const [naming, setNaming] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.crs.save.mutationOptions());

  const result = useMemo(() => computeCrs(toProfile(form), { rules }), [form, rules]);
  const breakdown = result.ok ? result.breakdown : null;
  const issueFor = (field: string): boolean => !result.ok && result.issues.some((i) => i.field === field);
  const pts = (points: number | undefined): string =>
    points === undefined ? '—' : t('points', { points });

  const markStarted = useCalculatorTracking('crs');
  const update = (next: CrsForm): void => {
    markStarted();
    setForm(next);
  };
  const set = <K extends keyof CrsForm>(key: K, value: CrsForm[K]): void => update({ ...form, [key]: value });
  const partnered = isPartnered(form.maritalStatus);
  const spouseCounts = partnered && form.spouseAccompanying && !form.spouseIsCanadianCitizenOrPR;
  const yearsOptions = (years: readonly number[], key: 'years' | 'foreignYears') =>
    years.map((y) => ({ value: String(y), label: t(`work.${key}`, { years: y }) }));

  const onSave = (): void => {
    if (!account) {
      router.push(withNext('/connexion', '/outils/crs'));
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.add({ title: tSummary('saveOffline'), type: 'warning' });
      return;
    }
    save.reset();
    setNaming(true);
  };

  const saveAs = (name: string): void => {
    save.mutate(
      { name, profile: toProfile(form), rules },
      {
        onSuccess: (saved) => {
          track('crs.saved', { total: saved.total });
          void queryClient.invalidateQueries({ queryKey: trpc.crs.list.queryKey() });
          setNaming(false);
          toast.add({ title: tSummary('saved'), type: 'success' });
        },
      },
    );
  };

  const openSaved = (profile: CrsProfile): void => update(fromProfile(profile));

  return (
    <div className="grid grid-cols-1 items-start gap-7 pb-20 lg:grid-cols-3 lg:pb-0">
      <PhoneScoreBar label={t('summary.total')} score={breakdown?.total ?? null} />
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <p className="text-body-sm text-slate">
          {t('rulesNote', { date: format.dateTime(new Date(rules), { dateStyle: 'long', timeZone: 'UTC' }) })}
        </p>
        <RulesChoice
          name="crs-rules"
          inForce={inForce}
          rules={rules}
          onChange={setRules}
          hint={t('rulesHint')}
        />

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
      </div>

      <div className="space-y-4 lg:sticky-below-nav">
        <ScoreSummary
          breakdown={breakdown}
          onSave={onSave}
          onReset={() => update(DEFAULT_FORM)}
          saving={save.isPending}
        />
        <ScoreAdvice profile={toProfile(form)} rules={rules} />
        {/* The User's own data on a static page: fetched in the browser, under a skeleton. */}
        {account ? (
          <QueryBoundary fallback={<SavedSimulationsSkeleton />}>
            <SavedSimulations onOpen={openSaved} />
          </QueryBoundary>
        ) : null}
        {naming ? (
          <SaveSimulationDialog
            open
            defaultName={t('summary.defaultName', { date: format.dateTime(today, { dateStyle: 'medium' }) })}
            saving={save.isPending}
            failed={save.isError}
            onSave={saveAs}
            onClose={() => setNaming(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
