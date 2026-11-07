'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The Tableau de bord runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { FamilyForm } from '@/features/client-forms/components/family-form';
import { HistoryForm } from '@/features/client-forms/components/history-form';
import { checkHistory, familyMissing, type Family, type PersonalHistory } from '@/features/client-forms/lib/form-schema';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

type Viewer = 'client' | 'consultant';

/**
 * A « Renseignements du client » Document filled in as a form (#79): the
 * Historique personnel et adresses or the Renseignements sur la famille,
 * for the Dossier's Client in « Mon espace » and the consultant in the
 * Tableau de bord. It is saved whole, and says what is still missing.
 */
export function ClientFormView({ documentId, viewer }: { documentId: string; viewer: Viewer }): ReactNode {
  const body = (
    <div className="mx-auto grid max-w-3xl min-w-0 grid-cols-1 gap-6">
      <QueryBoundary fallback={<FormSkeleton />}>
        <ClientForm documentId={documentId} viewer={viewer} />
      </QueryBoundary>
    </div>
  );
  if (viewer === 'consultant') return body;
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">{body}</main>
      <SiteFooter />
    </>
  );
}

function ClientForm({ documentId, viewer }: { documentId: string; viewer: Viewer }): ReactNode {
  const t = useTranslations('ClientForms');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.clientForms.get.queryOptions({ documentId }));
  const [history, setHistory] = useState<PersonalHistory>(() => data.data as PersonalHistory);
  const [family, setFamily] = useState<Family>(() => {
    const saved = data.data as Family;
    // The applicant's card is there from the start.
    return saved.members?.length ? saved : { members: [{ ...BLANK_APPLICANT, id: 'applicant' }] };
  });
  const [dirty, setDirty] = useState(false);
  const save = useMutation(
    trpc.clientForms.save.mutationOptions({
      onSuccess: ({ complete }) => {
        setDirty(false);
        void queryClient.invalidateQueries({ queryKey: trpc.clientForms.get.queryKey({ documentId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId: data.document.dossierId }) });
        toast.add({ title: complete ? t('savedComplete') : t('saved'), type: 'success' });
      },
      onError: () => toast.add({ title: t('failed'), type: 'error' }),
    }),
  );

  const isHistory = data.kind === 'personalHistory';
  const left = isHistory
    ? (() => {
        const check = checkHistory(history, new Date());
        return check.activityGaps.length + check.addressGaps.length + (history.birthDate ? 0 : 1);
      })()
    : familyMissing(family).length;
  const backHref = `/${viewer === 'client' ? 'mon-espace/' : ''}dossiers/${data.document.dossierId}?document=${documentId}#documents`;
  const back = (
    <>
      <ArrowLeft aria-hidden={true} className="size-4" />
      {t('back')}
    </>
  );
  const backClass = 'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep';

  return (
    <>
      {viewer === 'client' ? (
        <Link href={backHref} className={backClass}>
          {back}
        </Link>
      ) : (
        <NextLink href={backHref} className={backClass}>
          {back}
        </NextLink>
      )}
      <div>
        <h1 className="font-heading text-2xl font-bold break-words text-navy-deep md:text-3xl">{data.document.title}</h1>
        <p className="mt-1 text-sm text-slate">{t(isHistory ? 'history.intro' : 'family.intro')}</p>
        {data.updatedAt ? (
          <p className="mt-1 text-xs text-slate">
            {t('updated', {
              name: data.updatedBy ?? '',
              date: format.dateTime(data.updatedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            })}
          </p>
        ) : null}
      </div>

      {isHistory ? (
        <HistoryForm
          value={history}
          disabled={!data.editable}
          onChange={(next) => {
            setHistory(next);
            setDirty(true);
          }}
        />
      ) : (
        <FamilyForm
          value={family}
          disabled={!data.editable}
          onChange={(next) => {
            setFamily(next);
            setDirty(true);
          }}
        />
      )}

      {data.editable ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white/95 p-4 shadow-md backdrop-blur">
          <p className={`flex items-center gap-2 text-sm font-semibold ${left === 0 ? 'text-leaf' : 'text-crimson'}`}>
            {left === 0 ? <CheckCircle2 aria-hidden={true} className="size-4" /> : null}
            {left === 0 ? t('nothingMissing') : t('missingCount', { count: left })}
          </p>
          <button
            type="button"
            disabled={save.isPending || !dirty}
            onClick={() =>
              save.mutate(
                isHistory
                  ? { documentId, kind: 'personalHistory', data: history }
                  : { documentId, kind: 'familyInformation', data: family },
              )
            }
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            <Save aria-hidden={true} className="size-4" />
            {save.isPending ? t('saving') : dirty ? t('save') : t('savedState')}
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('closed')}</p>
      )}
    </>
  );
}

const BLANK_APPLICANT: Family['members'][number] = {
  id: 'applicant',
  relation: 'applicant',
  name: '',
  birthDate: null,
  birthCountry: '',
  maritalStatus: null,
  address: '',
  occupation: '',
  deceased: false,
  deathDate: null,
  deathPlace: '',
  accompanying: true,
};

function FormSkeleton(): ReactNode {
  const t = useTranslations('ClientForms');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-10 w-72 rounded-lg" />
      <Skeleton aria-hidden={true} className="h-64 rounded-2xl" />
    </div>
  );
}
