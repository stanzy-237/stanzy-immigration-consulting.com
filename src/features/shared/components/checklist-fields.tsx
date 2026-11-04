'use client';

import { ArrowRight, Info, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import {
  emptyJob,
  MAX_CHILDREN,
  MAX_ENTRIES,
  spouseComes,
  type ChecklistForm,
  type Job,
  type PrefillSource,
} from '@/features/checklist/lib/checklist-form';
import { CalculatorSection, CheckField, SelectField, TextField } from '@/features/shared/components/calculator-fields';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

const CHILDREN = Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => String(n));

function PrefillNote({ source }: { source: PrefillSource }): ReactNode {
  const t = useTranslations('Checklist.form');
  if (source.kind !== 'saved' && source.kind !== 'draft') return null;
  return (
    <p className="flex gap-2 rounded-xl border border-fog bg-ice-blue px-4 py-3 text-body-sm font-medium text-navy-deep">
      <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-steel-blue" />
      {source.kind === 'saved' ? t('prefilledSaved', { name: source.name }) : t('prefilledDraft')}
    </p>
  );
}

/** The names a list still lacks: empty job titles and countries, and a spouse who comes without a country. */
function missingNames(form: ChecklistForm) {
  const blank = (value: string) => value.trim() === '';
  return {
    jobs: form.jobs.map((job) => blank(job.title)),
    countries: form.countries.map(blank),
    spouseJobs: form.spouseJobs.map(blank),
    spouseCountries: form.spouseCountries.map(blank),
  };
}

/** A list of names (countries, a spouse's jobs): one field each, add and remove. */
function NamesField({
  values,
  missing,
  showErrors,
  label,
  addLabel,
  removeLabel,
  errorLabel,
  minimum,
  onChange,
}: {
  values: string[];
  missing: boolean[];
  showErrors: boolean;
  label: (number: number) => string;
  addLabel: string;
  removeLabel: (number: number) => string;
  errorLabel: string;
  minimum: number;
  onChange: (values: string[]) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      {values.map((value, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            <TextField
              label={label(i + 1)}
              value={value}
              error={showErrors && missing[i] ? errorLabel : undefined}
              onChange={(next) => onChange(values.map((v, j) => (j === i ? next : v)))}
            />
          </div>
          {values.length > minimum ? (
            <RemoveButton label={removeLabel(i + 1)} onClick={() => onChange(values.filter((_, j) => j !== i))} />
          ) : null}
        </div>
      ))}
      {values.length < MAX_ENTRIES ? <AddButton label={addLabel} onClick={() => onChange([...values, ''])} /> : null}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mt-7 grid size-12 shrink-0 place-items-center rounded-xl border border-fog text-slate transition-colors hover:border-rouge hover:text-rouge"
    >
      <Trash2 aria-hidden={true} className="size-4" />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 self-start rounded-full border-2 border-dashed border-fog px-4 font-heading text-body-sm font-bold text-navy-deep transition-colors hover:border-navy-deep"
    >
      <Plus aria-hidden={true} className="size-4" />
      {label}
    </button>
  );
}

/**
 * The Checklist's questions (#38): family, studies, jobs, countries, special
 * cases; the answers that change which documents IRCC asks for. Used by the
 * Checklist and by the Demande d'intérêt (#81). `aside` draws beside the
 * fields from the answers being typed (the Checklist's live preview).
 */
export function ChecklistFields({
  answers: initial,
  source,
  submitLabel,
  aside,
  onContinue,
}: {
  answers: ChecklistForm;
  source: PrefillSource;
  /** The button's words; « Continuer » by default. */
  submitLabel?: string;
  aside?: (form: ChecklistForm) => ReactNode;
  onContinue: (answers: ChecklistForm) => void;
}): ReactNode {
  const t = useTranslations('Checklist.form');
  const tFamily = useTranslations('Calculators.family');
  const [form, setForm] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const update = (patch: Partial<ChecklistForm>) => setForm((current) => ({ ...current, ...patch }));
  const partnered = isPartnered(form.maritalStatus);
  const withSpouse = spouseComes(form);
  const missing = missingNames(form);
  const incomplete =
    [...missing.jobs, ...missing.countries].some(Boolean) ||
    (withSpouse && ([...missing.spouseJobs, ...missing.spouseCountries].some(Boolean) || form.spouseCountries.length === 0));

  const setJob = (index: number, patch: Partial<Job>) =>
    update({ jobs: form.jobs.map((job, i) => (i === index ? { ...job, ...patch } : job)) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (incomplete) {
      setShowErrors(true);
      return;
    }
    const trim = (values: string[]) => values.map((value) => value.trim());
    onContinue({
      ...form,
      spouseAccompanying: withSpouse,
      spouseClaimsPoints: withSpouse && form.spouseClaimsPoints,
      jobs: form.jobs.map((job) => ({ ...job, title: job.title.trim() })),
      countries: trim(form.countries),
      spouseJobs: withSpouse ? trim(form.spouseJobs) : [],
      spouseCountries: withSpouse ? trim(form.spouseCountries) : [],
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className={aside ? 'grid grid-cols-1 items-start gap-7 lg:grid-cols-3' : 'grid grid-cols-1 items-start gap-7'}
    >
      <div className={aside ? 'flex min-w-0 flex-col gap-4 lg:col-span-2' : 'flex min-w-0 flex-col gap-4'}>
      <PrefillNote source={source} />

      <CalculatorSection id="checklist-family" title={t('family')} accent="steel">
        <div className="flex flex-col gap-3">
          <SelectField<MaritalStatus>
            label={tFamily('marital')}
            value={form.maritalStatus}
            options={MARITAL_STATUSES.map((status) => ({ value: status, label: tFamily(`maritalOptions.${status}`) }))}
            onChange={(maritalStatus) => update({ maritalStatus })}
          />
          {partnered ? (
            <CheckField
              label={t('spouseAccompanying')}
              checked={form.spouseAccompanying}
              onChange={(spouseAccompanying) =>
                update({
                  spouseAccompanying,
                  // A spouse who comes needs at least one police certificate.
                  spouseCountries: spouseAccompanying && form.spouseCountries.length === 0 ? [''] : form.spouseCountries,
                })
              }
            />
          ) : null}
          {withSpouse ? (
            <CheckField
              label={t('spouseClaimsPoints')}
              checked={form.spouseClaimsPoints}
              onChange={(spouseClaimsPoints) => update({ spouseClaimsPoints })}
            />
          ) : null}
          {partnered || form.maritalStatus === 'separated' ? (
            <CheckField label={t('previousUnion')} checked={form.previousUnion} onChange={(previousUnion) => update({ previousUnion })} />
          ) : null}
          <SelectField
            label={t('children')}
            hint={t('childrenHint')}
            value={String(form.children)}
            options={CHILDREN.map((n) => ({ value: n, label: n }))}
            onChange={(children) => update({ children: Number(children) })}
          />
        </div>
      </CalculatorSection>

      <CalculatorSection id="checklist-education" title={t('education')}>
        <div className="flex flex-col gap-3">
          <CheckField label={t('foreignEducation')} checked={form.foreignEducation} onChange={(foreignEducation) => update({ foreignEducation })} />
          <CheckField label={t('canadianEducation')} checked={form.canadianEducation} onChange={(canadianEducation) => update({ canadianEducation })} />
          <CheckField label={t('secondLanguage')} checked={form.secondLanguage} onChange={(secondLanguage) => update({ secondLanguage })} />
        </div>
      </CalculatorSection>

      <CalculatorSection id="checklist-jobs" title={t('jobs')} subtitle={t('jobsHint')}>
        <div className="flex flex-col gap-3">
          {form.jobs.map((job, i) => (
            <div key={i} className="rounded-xl border border-fog-light p-3.5">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <TextField
                    label={t('jobTitle', { number: i + 1 })}
                    value={job.title}
                    autoComplete="organization-title"
                    error={showErrors && missing.jobs[i] ? t('titleRequired') : undefined}
                    onChange={(title) => setJob(i, { title })}
                  />
                </div>
                {form.jobs.length > 1 ? (
                  <RemoveButton label={t('removeJob', { number: i + 1 })} onClick={() => update({ jobs: form.jobs.filter((_, j) => j !== i) })} />
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <CheckField label={t('jobInCanada')} checked={job.inCanada} onChange={(inCanada) => setJob(i, { inCanada })} />
                <CheckField label={t('jobSelfEmployed')} checked={job.selfEmployed} onChange={(selfEmployed) => setJob(i, { selfEmployed })} />
              </div>
            </div>
          ))}
          {form.jobs.length < MAX_ENTRIES ? <AddButton label={t('addJob')} onClick={() => update({ jobs: [...form.jobs, emptyJob()] })} /> : null}
          <CheckField label={t('canadianWork')} checked={form.canadianWork} onChange={(canadianWork) => update({ canadianWork })} />
          <CheckField label={t('authorizedToWork')} checked={form.authorizedToWork} onChange={(authorizedToWork) => update({ authorizedToWork })} />
        </div>
      </CalculatorSection>

      <CalculatorSection id="checklist-countries" title={t('countries')} subtitle={t('countriesHint')}>
        <NamesField
          values={form.countries}
          missing={missing.countries}
          showErrors={showErrors}
          label={(number) => t('country', { number })}
          addLabel={t('addCountry')}
          removeLabel={(number) => t('removeCountry', { number })}
          errorLabel={t('countryRequired')}
          minimum={1}
          onChange={(countries) => update({ countries })}
        />
      </CalculatorSection>

      {withSpouse ? (
        <CalculatorSection id="checklist-spouse" title={t('spouse')}>
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="font-heading text-body font-bold text-navy-deep">{t('spouseJobs')}</h3>
              <p className="mb-3 text-body-sm text-slate">{t('spouseJobsHint')}</p>
              <NamesField
                values={form.spouseJobs}
                missing={missing.spouseJobs}
                showErrors={showErrors}
                label={(number) => t('jobTitle', { number })}
                addLabel={t('addJob')}
                removeLabel={(number) => t('removeJob', { number })}
                errorLabel={t('titleRequired')}
                minimum={0}
                onChange={(spouseJobs) => update({ spouseJobs })}
              />
            </div>
            <div>
              <h3 className="mb-3 font-heading text-body font-bold text-navy-deep">{t('spouseCountries')}</h3>
              <NamesField
                values={form.spouseCountries}
                missing={missing.spouseCountries}
                showErrors={showErrors}
                label={(number) => t('country', { number })}
                addLabel={t('addCountry')}
                removeLabel={(number) => t('removeCountry', { number })}
                errorLabel={t('countryRequired')}
                minimum={1}
                onChange={(spouseCountries) => update({ spouseCountries })}
              />
            </div>
          </div>
        </CalculatorSection>
      ) : null}

      <CalculatorSection id="checklist-special" title={t('special')}>
        <div className="flex flex-col gap-3">
          <CheckField label={t('jobOffer')} checked={form.jobOffer} onChange={(jobOffer) => update({ jobOffer })} />
          <CheckField
            label={t('provincialNomination')}
            checked={form.provincialNomination}
            onChange={(provincialNomination) => update({ provincialNomination })}
          />
          <CheckField
            label={t('certificateOfQualification')}
            checked={form.certificateOfQualification}
            onChange={(certificateOfQualification) => update({ certificateOfQualification })}
          />
          <CheckField label={t('siblingInCanada')} checked={form.siblingInCanada} onChange={(siblingInCanada) => update({ siblingInCanada })} />
          <CheckField label={t('representative')} checked={form.representative} onChange={(representative) => update({ representative })} />
        </div>
      </CalculatorSection>

      <div className="flex flex-col items-stretch gap-3 sm:items-end">
        {showErrors && incomplete ? (
          <p role="alert" className="text-body-sm font-medium text-rouge">
            {t('fixErrors')}
          </p>
        ) : null}
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rouge px-8 font-heading text-body font-bold text-white transition-colors hover:bg-crimson"
        >
          {submitLabel ?? t('continue')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
      </div>
      </div>
      {aside?.(form)}
    </form>
  );
}
