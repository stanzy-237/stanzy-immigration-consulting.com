'use client';

import { useMutation, useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Info, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import {
  storeChecklistAnswers,
  useStoredChecklistAnswers,
} from '@/features/checklist/hooks/use-stored-checklist';
import {
  choosePrefill,
  emptyJob,
  MAX_CHILDREN,
  MAX_ENTRIES,
  spouseComes,
  type ChecklistForm,
  type Job,
  type PrefillSource,
} from '@/features/checklist/lib/checklist-form';
import { ChecklistPreview } from '@/features/checklist/components/checklist-preview';
import { useCrsDraftValue } from '@/features/crs/hooks/use-crs-draft';
import { fromProfile } from '@/features/crs/lib/crs-form';
import { CalculatorSection, CheckField, SelectField, TextField } from '@/features/shared/components/calculator-fields';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';
import { useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

const LIST_PATH = '/outils/checklist/liste';
const CHILDREN = Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => String(n));

/** What the Checklist asks before the list: the answers that change which documents IRCC wants. */
export function ChecklistFormPanel(): ReactNode {
  const { account, pending } = useCurrentAccount();
  if (pending) return <ChecklistFormSkeleton />;
  if (account) {
    return (
      <QueryBoundary fallback={<ChecklistFormSkeleton />}>
        <SignedInChecklistForm />
      </QueryBoundary>
    );
  }
  return <VisitorChecklistForm />;
}

/** A visitor: the answers kept in this browser, else the CRS calculator's draft. */
function VisitorChecklistForm(): ReactNode {
  const own = useStoredChecklistAnswers();
  const draft = useCrsDraftValue();
  const router = useRouter();
  const prefill = choosePrefill({ own, saved: null, draft });
  return (
    <ChecklistFields
      // Storage is only read once hydrated: open again on what it holds.
      key={prefill.source.kind}
      {...prefill}
      onContinue={(answers) => {
        storeChecklistAnswers(answers);
        router.push(LIST_PATH);
      }}
    />
  );
}

/** A User: the Checklist saved in the Account, else their latest saved CRS Simulation. */
function SignedInChecklistForm(): ReactNode {
  const trpc = useTRPC();
  const [checklist, simulations] = useSuspenseQueries({
    queries: [trpc.checklist.get.queryOptions(), trpc.crs.list.queryOptions()],
  });
  const local = useStoredChecklistAnswers();
  const own = checklist.data?.answers ?? local;
  const latest = simulations.data[0];

  if (!own && latest) return <FromSavedSimulation id={latest.id} name={latest.name} />;
  return <SignedInFields prefill={choosePrefill({ own, saved: null, draft: null })} />;
}

function FromSavedSimulation({ id, name }: { id: string; name: string }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.crs.get.queryOptions({ id }));
  return <SignedInFields prefill={choosePrefill({ own: null, saved: { name, answers: fromProfile(data.profile) }, draft: null })} />;
}

/** « Continuer » keeps the answers here and in the Account, and opens the list at once. */
function SignedInFields({ prefill }: { prefill: ReturnType<typeof choosePrefill> }): ReactNode {
  const t = useTranslations('Checklist.form');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const key = trpc.checklist.get.queryKey();
  const save = useMutation(
    trpc.checklist.saveAnswers.mutationOptions({
      onMutate: async (answers) => {
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData(key, (old) => ({ answers, ready: old?.ready ?? [] }));
      },
      // The list keeps the new answers from this device's copy; say they aren't in the Account.
      onError: () => toast.add({ title: t('saveFailed'), type: 'error' }),
    }),
  );
  return (
    <ChecklistFields
      {...prefill}
      onContinue={(answers) => {
        storeChecklistAnswers(answers);
        save.mutate(answers);
        router.push(LIST_PATH);
      }}
    />
  );
}

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

function ChecklistFields({
  answers: initial,
  source,
  onContinue,
}: {
  answers: ChecklistForm;
  source: PrefillSource;
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
    <form onSubmit={submit} noValidate className="grid grid-cols-1 items-start gap-7 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
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
          {t('continue')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
      </div>
      </div>
      <ChecklistPreview form={form} />
    </form>
  );
}

/** The form's cards while the Account's answers load. */
export function ChecklistFormSkeleton(): ReactNode {
  const t = useTranslations('Checklist.form');
  return (
    <div role="status" className="grid grid-cols-1 items-start gap-7 lg:grid-cols-3">
      <span className="sr-only">{t('loading')}</span>
      <div className="flex flex-col gap-4 lg:col-span-2">
        {['h-56', 'h-40', 'h-72', 'h-28'].map((height, i) => (
          <Skeleton key={i} aria-hidden={true} className={`${height} rounded-2xl`} />
        ))}
      </div>
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
