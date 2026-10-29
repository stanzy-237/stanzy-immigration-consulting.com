'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DrawAlerts } from '@/features/draws/components/draw-alerts';
import { DrawsHistory } from '@/features/draws/components/draws-history';
import { LatestDrawCard } from '@/features/draws/components/latest-draw-card';
import { NextDrawPreview } from '@/features/draws/components/next-draw-preview';
import { useTRPC } from '@/trpc/client';

/** The Derniers tirages page body: hero with the latest Tirage, alerts, history. */
export function DrawsBoard(): ReactNode {
  const t = useTranslations('Draws');

  return (
    <>
      <header className="bg-linear-135 from-navy-deep to-navy-80 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-7">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/30 bg-rouge/15 px-4 py-1.5 font-label font-semibold uppercase text-rose">
            <span aria-hidden={true} className="size-1.5 animate-pulse rounded-full bg-live" />
            {t('eyebrow')}
          </p>
          <h1 className="mb-2 font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">{t('title')}</h1>
          <p className="mb-2 text-base text-white/60">{t('subtitle')}</p>
          <QueryBoundary tone="dark" fallback={<LatestDrawSkeleton />}>
            <LatestDraw />
          </QueryBoundary>
        </div>
      </header>
      {/* The history below reports a failure once; the teaser just stays out. */}
      <QueryBoundary fallback={null} renderError={() => null}>
        <DrawsHistoryPart part="preview" />
      </QueryBoundary>
      <DrawAlerts />
      <QueryBoundary fallback={<DrawsHistorySkeleton />}>
        <DrawsHistoryPart part="history" />
      </QueryBoundary>
    </>
  );
}

/** « Mis à jour … » and the newest Tirage's card. */
function LatestDraw(): ReactNode {
  const t = useTranslations('Draws');
  const format = useFormatter();
  const trpc = useTRPC();
  // The same input as the route's prefetch, so it's read from the hydrated cache.
  const { data } = useSuspenseQuery(trpc.draws.latest.queryOptions({ take: 1 }));
  const newest = data.draws[0];

  return (
    <>
      {/* Relative to now: the static HTML can be a few minutes behind the browser. */}
      {data.lastSyncedAt ? (
        <p suppressHydrationWarning className="mb-8 text-xs text-white/50">{t('synced', { when: format.relativeTime(data.lastSyncedAt, new Date()) })}</p>
      ) : (
        <div className="mb-8" />
      )}
      {newest ? <LatestDrawCard draw={newest} /> : <p className="rounded-2xl bg-white/10 p-6 text-white/80">{t('neverSynced')}</p>}
    </>
  );
}

/** The next-Tirage teaser or the history table, both from every stored Tirage. */
function DrawsHistoryPart({ part }: { part: 'preview' | 'history' }): ReactNode {
  const trpc = useTRPC();
  const { data: draws } = useSuspenseQuery(trpc.draws.list.queryOptions());
  if (draws.length === 0) return null;
  return part === 'preview' ? <NextDrawPreview draws={draws} /> : <DrawsHistory draws={draws} />;
}

/** The « Mis à jour » line and the latest Tirage's card, on navy. */
function LatestDrawSkeleton(): ReactNode {
  const t = useTranslations('Common');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="mb-8 h-3 w-40 bg-white/10" />
      <Skeleton aria-hidden={true} className="h-80 rounded-3xl bg-white/10 lg:h-64" />
    </div>
  );
}

/** The history's heading and rows. */
function DrawsHistorySkeleton(): ReactNode {
  const t = useTranslations('Common');
  return (
    <div role="status" className="mx-auto max-w-7xl px-4 py-10 sm:px-7">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true}>
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
