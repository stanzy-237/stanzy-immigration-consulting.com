'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { EDUCATION_LEVELS, HIGH_WAGE_LEVELS } from '@/features/crs/data/crs-criteria';
import { useCrsDraft } from '@/features/crs/hooks/use-crs-draft';
import {
  computeCrs,
  isPartnered,
  MARITAL_STATUSES,
  rulesInForceOn,
  type CrsProfile,
  type RulesVersion,
} from '@/features/crs/lib/compute-crs';
import {
  DEFAULT_FORM,
  emptyLanguage,
  fromProfile,
  toProfile,
  type CrsForm,
} from '@/features/crs/lib/crs-form';
import { track } from '@/lib/analytics';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/trpc/react';

import { CheckField, CrsSection, NumberField, SelectField } from '@/features/crs/components/crs-fields';
import { LanguageFields } from '@/features/crs/components/language-fields';
import { SaveSimulationDialog } from '@/features/crs/components/save-simulation-dialog';
import { SavedSimulations } from '@/features/crs/components/saved-simulations';
import { ScoreAdvice } from '@/features/crs/components/score-advice';
import { ScoreSummary } from '@/features/crs/components/score-summary';

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
  const format = useFormatter();
  const router = useRouter();
  const { account } = useCurrentAccount();
  const [form, setForm] = useCrsDraft();
  const inForce = rulesInForceOn(today);
  const [rules, setRules] = useState<RulesVersion>(inForce);
  const [offline, setOffline] = useState(false);
  const [naming, setNaming] = useState(false);
  const utils = api.useUtils();
  const save = api.crs.save.useMutation();

  const result = useMemo(() => computeCrs(toProfile(form), { rules }), [form, rules]);
  const breakdown = result.ok ? result.breakdown : null;
  const issueFor = (field: string): boolean => !result.ok && result.issues.some((i) => i.field === field);
  const pts = (points: number | undefined): string =>
    points === undefined ? '—' : t('points', { points });

  // Analytics: one event per visit, one on the first answer. No answers are sent.
  const started = useRef(false);
  useEffect(() => track('crs.viewed'), []);
  const update = (next: CrsForm): void => {
    if (!started.current) {
      started.current = true;
      track('crs.started');
    }
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
      setOffline(true);
      return;
    }
    setOffline(false);
    save.reset();
    setNaming(true);
  };

  const saveAs = (name: string): void => {
    save.mutate(
      { name, profile: toProfile(form), rules },
      {
        onSuccess: (saved) => {
          track('crs.saved', { total: saved.total });
          void utils.crs.list.invalidate();
          setNaming(false);
        },
      },
    );
  };

  const openSaved = (profile: CrsProfile): void => update(fromProfile(profile));

  return (
    <div className="grid grid-cols-1 items-start gap-7 pb-20 lg:grid-cols-3 lg:pb-0">
      {/* Phones: the total stays in view while scrolling the questions. The
          announced score is the one in the result card below. */}
      <div
        aria-hidden={true}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-white/10 bg-navy-deep px-5 py-3 text-white shadow-lg lg:hidden"
      >
        <span className="font-label text-white/60">{t('summary.total')}</span>
        <span className="font-heading text-h3 font-bold">{breakdown?.total ?? '—'}</span>
      </div>
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <p className="text-body-sm text-slate">
          {t('rulesNote', { date: format.dateTime(new Date(rules), { dateStyle: 'long', timeZone: 'UTC' }) })}
        </p>
        {inForce === '2025-03-25' ? (
          <fieldset className="rounded-2xl border border-fog bg-white p-4">
            <legend className="px-1 font-label text-slate">
              {t('rulesChoice.legend')}
            </legend>
            <div className="flex flex-wrap gap-4">
              {(['2025-03-25', '2026-11-03'] as const).map((version) => (
                <label key={version} className="flex items-center gap-2 text-body-sm font-semibold text-navy-deep">
                  <input
                    type="radio"
                    name="crs-rules"
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

        <CrsSection id="family" title={t('sections.family')} accent="steel">
          <SelectField
            label={t('family.marital')}
            value={form.maritalStatus}
            options={MARITAL_STATUSES.map((m) => ({ value: m, label: t(`family.maritalOptions.${m}`) }))}
            onChange={(maritalStatus) => set('maritalStatus', maritalStatus)}
          />
          {partnered ? (
            <>
              <SelectField
                label={t('family.accompanying')}
                value={form.spouseAccompanying ? 'yes' : 'no'}
                options={[
                  { value: 'no', label: t('family.accompanyingNo') },
                  { value: 'yes', label: t('family.accompanyingYes') },
                ]}
                onChange={(v) => set('spouseAccompanying', v === 'yes')}
              />
              <CheckField
                label={t('family.citizenOrPR')}
                checked={form.spouseIsCanadianCitizenOrPR}
                onChange={(v) => set('spouseIsCanadianCitizenOrPR', v)}
              />
              <p className="text-body-sm text-slate">{t('family.note')}</p>
            </>
          ) : null}
        </CrsSection>

        <CrsSection id="age" title={t('sections.age')} points={pts(breakdown?.core.age)} accent="rouge">
          <NumberField
            label={t('age.label')}
            value={form.age}
            inputMode="numeric"
            onChange={(age) => set('age', age)}
            hint={t('age.hint')}
            error={issueFor('age') ? t('age.invalid') : undefined}
          />
        </CrsSection>

        <CrsSection id="education" title={t('sections.education')} points={pts(breakdown?.core.education)} accent="navy">
          <SelectField
            label={t('education.label')}
            value={form.education}
            options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.options.${e}`) }))}
            onChange={(education) => set('education', education)}
            hint={t('education.hint')}
          />
        </CrsSection>

        <CrsSection id="first-language" title={t('sections.firstLanguage')} points={pts(breakdown?.core.firstLanguage)} accent="steel">
          <LanguageFields slot="firstLanguage" value={form.firstLanguage} onChange={(v) => set('firstLanguage', v)} />
          <button
            type="button"
            onClick={() => set('secondLanguage', form.secondLanguage ? null : emptyLanguage())}
            className="rounded-full border border-fog bg-ice-blue px-4 py-2 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-fog"
          >
            {form.secondLanguage ? t('language.removeSecond') : t('language.addSecond')}
          </button>
        </CrsSection>

        {form.secondLanguage ? (
          <CrsSection id="second-language" title={t('sections.secondLanguage')} points={pts(breakdown?.core.secondLanguage)} accent="steel">
            <LanguageFields
              slot="secondLanguage"
              value={form.secondLanguage}
              onChange={(v) => set('secondLanguage', v)}
              error={issueFor('secondLanguage') ? t('language.sameLanguage') : undefined}
            />
          </CrsSection>
        ) : null}

        <CrsSection id="work" title={t('sections.work')} points={pts(breakdown?.core.canadianWork)} accent="navy">
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
        </CrsSection>

        <CrsSection id="additional" title={t('sections.additional')} points={pts(breakdown?.additional.total)} accent="rouge">
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
        </CrsSection>

        {spouseCounts ? (
          <CrsSection id="spouse" title={t('sections.spouse')} points={pts(breakdown?.spouse.total)} accent="rouge">
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
          </CrsSection>
        ) : null}
      </div>

      <div className="space-y-4 lg:sticky-below-nav">
        <ScoreSummary
          breakdown={breakdown}
          onSave={onSave}
          onReset={() => update(DEFAULT_FORM)}
          saving={save.isPending}
          saved={save.isSuccess}
          offline={offline}
        />
        <ScoreAdvice profile={toProfile(form)} rules={rules} />
        {account ? <SavedSimulations onOpen={openSaved} /> : null}
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
