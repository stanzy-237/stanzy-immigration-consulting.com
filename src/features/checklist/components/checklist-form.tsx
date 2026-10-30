'use client';

import { useMutation, useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Info } from 'lucide-react';
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
  MAX_CHILDREN,
  MAX_POLICE_COUNTRIES,
  type ChecklistForm,
  type PrefillSource,
} from '@/features/checklist/lib/checklist-form';
import { useCrsDraftValue } from '@/features/crs/hooks/use-crs-draft';
import { fromProfile } from '@/features/crs/lib/crs-form';
import { CalculatorSection, CheckField, SelectField } from '@/features/shared/components/calculator-fields';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';
import { useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

const LIST_PATH = '/outils/checklist/liste';
const CHILDREN = Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => String(n));
const COUNTRIES = Array.from({ length: MAX_POLICE_COUNTRIES }, (_, n) => String(n + 1));

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
  const update = (patch: Partial<ChecklistForm>) => setForm((current) => ({ ...current, ...patch }));
  const partnered = isPartnered(form.maritalStatus);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onContinue({
      ...form,
      spouseAccompanying: partnered && form.spouseAccompanying,
      spouseClaimsPoints: partnered && form.spouseAccompanying && form.spouseClaimsPoints,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
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
              onChange={(spouseAccompanying) => update({ spouseAccompanying })}
            />
          ) : null}
          {partnered && form.spouseAccompanying ? (
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
        </div>
      </CalculatorSection>

      <CalculatorSection id="checklist-language" title={t('language')}>
        <CheckField label={t('secondLanguage')} checked={form.secondLanguage} onChange={(secondLanguage) => update({ secondLanguage })} />
      </CalculatorSection>

      <CalculatorSection id="checklist-work" title={t('work')}>
        <div className="flex flex-col gap-3">
          <CheckField label={t('foreignWork')} checked={form.foreignWork} onChange={(foreignWork) => update({ foreignWork })} />
          <CheckField label={t('canadianWork')} checked={form.canadianWork} onChange={(canadianWork) => update({ canadianWork })} />
          <CheckField label={t('selfEmployed')} checked={form.selfEmployed} onChange={(selfEmployed) => update({ selfEmployed })} />
          <CheckField label={t('authorizedToWork')} checked={form.authorizedToWork} onChange={(authorizedToWork) => update({ authorizedToWork })} />
        </div>
      </CalculatorSection>

      <CalculatorSection id="checklist-countries" title={t('countries')}>
        <SelectField
          label={t('policeCountries')}
          hint={t('policeCountriesHint')}
          value={String(form.policeCountries)}
          options={COUNTRIES.map((n) => ({ value: n, label: n }))}
          onChange={(policeCountries) => update({ policeCountries: Number(policeCountries) })}
        />
      </CalculatorSection>

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

      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-full bg-rouge px-8 font-heading text-body font-bold text-white transition-colors hover:bg-crimson sm:self-end"
      >
        {t('continue')}
        <ArrowRight aria-hidden={true} className="size-4" />
      </button>
    </form>
  );
}

/** The form's cards while the Account's answers load. */
export function ChecklistFormSkeleton(): ReactNode {
  const t = useTranslations('Checklist.form');
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t('loading')}</span>
      {['h-56', 'h-40', 'h-28', 'h-56'].map((height, i) => (
        <Skeleton key={i} aria-hidden={true} className={`${height} rounded-2xl`} />
      ))}
    </div>
  );
}
