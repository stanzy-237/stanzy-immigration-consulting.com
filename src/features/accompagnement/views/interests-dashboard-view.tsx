'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { INTEREST_FILTERS } from '@/features/accompagnement/lib/interest-schema';
import { useTRPC } from '@/trpc/client';

type Filter = (typeof INTEREST_FILTERS)[number];

export const STATUS_STYLES = {
  SUBMITTED: 'bg-honey-tint text-honey',
  APPROVED: 'bg-leaf-tint text-leaf',
  REJECTED: 'bg-fog-light text-slate',
} as const;

/** « Demandes d'intérêt » (#81): the Accompagnement requests, « À traiter » first. */
export function InterestsDashboardView(): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate">{t('intro')}</p>
      </div>
      <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
        {INTEREST_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? 'inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white'
                : 'inline-flex h-10 items-center rounded-full border border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep'
            }
          >
            {t(`filters.${value}`)}
          </button>
        ))}
      </div>
      <QueryBoundary fallback={<ListSkeleton />}>
        <InterestList filter={filter} />
      </QueryBoundary>
    </div>
  );
}

function InterestList({ filter }: { filter: Filter }): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  const format = useFormatter();
  const trpc = useTRPC();
  // « À traiter » is prefetched; another filter loads with the list kept on screen.
  const initial = useSuspenseQuery(trpc.accompagnement.dashboard.list.queryOptions({ filter: 'SUBMITTED' }));
  const other = useQuery({
    ...trpc.accompagnement.dashboard.list.queryOptions({ filter }),
    enabled: filter !== 'SUBMITTED',
    placeholderData: (previous) => previous,
  });
  const rows = filter === 'SUBMITTED' ? initial.data : (other.data ?? []);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('empty')}
      </p>
    );
  }
  return (
    <ul aria-busy={other.isFetching} className="grid grid-cols-1 gap-2">
      {rows.map((row) => {
        const level = row.levelOverride ?? row.level;
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy-deep">{row.account.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                  {t(`status.${row.status}`)}
                </span>
                <span className="rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold text-navy-deep">
                  {t(`levels.${level}`)}
                </span>
              </p>
              <p className="truncate text-sm text-slate">
                {row.account.email} · {t('sentOn', { date: format.dateTime(row.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) })}
              </p>
            </div>
            <Link
              href={`/demandes/${row.id}`}
              aria-label={t('openLabel', { name: row.account.name })}
              className="inline-flex h-10 items-center rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
            >
              {t('open')}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton(): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  return (
    <div role="status" className="grid grid-cols-1 gap-2">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} aria-hidden={true} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
