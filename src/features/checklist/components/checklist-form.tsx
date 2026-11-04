'use client';

import { useMutation, useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import {
  storeChecklistAnswers,
  useStoredChecklistAnswers,
} from '@/features/checklist/hooks/use-stored-checklist';
import { choosePrefill } from '@/features/checklist/lib/checklist-form';
import { ChecklistPreview } from '@/features/checklist/components/checklist-preview';
import { useCrsDraftValue } from '@/features/crs/hooks/use-crs-draft';
import { fromProfile } from '@/features/crs/lib/crs-form';
import { ChecklistFields } from '@/features/shared/components/checklist-fields';
import { useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

const LIST_PATH = '/outils/checklist/liste';

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
      aside={(form) => <ChecklistPreview form={form} />}
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
      aside={(form) => <ChecklistPreview form={form} />}
      onContinue={(answers) => {
        storeChecklistAnswers(answers);
        save.mutate(answers);
        router.push(LIST_PATH);
      }}
    />
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
