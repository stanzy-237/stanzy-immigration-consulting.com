'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DossierStatePill, StageSummary } from '@/features/dossiers/components/stage-stepper';
import { DOSSIER_FILTERS, type DossierFilter } from '@/features/dossiers/lib/dossier-schema';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useTRPC } from '@/trpc/client';

const head = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate';
const cell = 'px-4 py-3 align-middle text-sm text-navy-deep';

/** The Dossiers section's home: every Dossier, last changed first, filterable by state. */
export function DossiersDashboardListView(): ReactNode {
  const t = useTranslations('Dossiers.dashboard');
  const [filter, setFilter] = useState<DossierFilter>('OPEN');
  // The current list stays on screen while another filter's loads.
  const [, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // The route prefetched « En cours »; fetch the others so switching is instant.
  useEffect(() => {
    for (const state of DOSSIER_FILTERS) {
      void queryClient.prefetchQuery(trpc.dossiers.dashboard.list.queryOptions({ state }));
    }
  }, [queryClient, trpc]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
        <Link
          href="/dossiers/nouveau"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
        >
          <Plus aria-hidden={true} className="size-4" />
          {t('newDossier')}
        </Link>
      </div>

      <div role="group" aria-label={t('filterLabel')} className="mb-5 flex flex-wrap gap-2">
        {DOSSIER_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => startTransition(() => setFilter(value))}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {t(`filters.${value}`)}
          </button>
        ))}
      </div>

      <QueryBoundary fallback={<DossierListSkeleton />}>
        <DossierList filter={filter} />
      </QueryBoundary>
    </div>
  );
}

/** The Dossiers `filter` keeps: a table on wide screens, cards on phones. */
function DossierList({ filter }: { filter: DossierFilter }): ReactNode {
  const t = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: dossiers } = useSuspenseQuery(trpc.dossiers.dashboard.list.queryOptions({ state: filter }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'short', year: 'numeric' });

  if (dossiers.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">
        {t('dashboard.empty')}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-fog-light bg-white shadow-sm md:block">
        <table className="w-full border-collapse">
          <thead className="border-b border-fog-light bg-off-white">
            <tr>
              <th scope="col" className={head}>{t('dashboard.columns.client')}</th>
              <th scope="col" className={head}>{t('dashboard.columns.service')}</th>
              <th scope="col" className={head}>{t('dashboard.columns.stage')}</th>
              <th scope="col" className={head}>{t('dashboard.columns.state')}</th>
              <th scope="col" className={head}>{t('dashboard.columns.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier) => (
              <tr key={dossier.id} className="border-b border-off-white last:border-b-0 hover:bg-off-white">
                <td className={cell}>
                  <Link href={`/dossiers/${dossier.id}`} className="font-semibold hover:text-rouge">
                    {dossier.account.name}
                  </Link>
                  <span className="block text-xs text-slate">{dossier.account.email}</span>
                </td>
                <td className={cell}>{t(`services.${dossier.service}`)}</td>
                <td className={cell}>
                  <StageSummary service={dossier.service} stage={dossier.stage} />
                </td>
                <td className={cell}>
                  <DossierStatePill dossier={dossier} />
                </td>
                <td className={`${cell} whitespace-nowrap text-slate`}>{date(dossier.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {dossiers.map((dossier) => (
          <li key={dossier.id}>
            <Link
              href={`/dossiers/${dossier.id}`}
              className="block rounded-2xl border border-fog-light bg-white p-4 shadow-sm hover:border-navy-deep"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold text-navy-deep">{dossier.account.name}</span>
                <DossierStatePill dossier={dossier} />
              </span>
              <span className="mt-1 block text-sm text-navy-deep">{t(`services.${dossier.service}`)}</span>
              <span className="mt-1 block text-xs text-navy-deep">
                <StageSummary service={dossier.service} stage={dossier.stage} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function DossierListSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.dashboard');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
