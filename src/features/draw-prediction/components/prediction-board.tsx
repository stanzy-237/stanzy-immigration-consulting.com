'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturedPrediction } from '@/features/draw-prediction/components/featured-prediction';
import { GroupPredictions } from '@/features/draw-prediction/components/group-predictions';
import { predictNextDraws } from '@/features/draw-prediction/lib/predict-next-draws';
import { useTRPC } from '@/trpc/client';

/** A block the hero's prediction already reports failures for: hidden when it fails. */
const hidden = () => null;

/**
 * The Prochain tirage page body: hero with the most likely next Tirage, the
 * « estimation, pas une garantie » warning, then every active group. Computed
 * in the browser from `draws.list`, so it follows each new Tirage by itself.
 */
export function PredictionBoard(): ReactNode {
  const t = useTranslations('DrawPrediction');

  return (
    <>
      <header className="bg-linear-135 from-navy-deep to-navy-80 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-7">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/30 bg-rouge/15 px-4 py-1.5 font-label font-semibold uppercase text-rose">
            <span aria-hidden={true} className="size-1.5 rounded-full bg-rose" />
            {t('eyebrow')}
          </p>
          <h1 className="mb-2 font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">{t('title')}</h1>
          <p className="mb-2 text-base text-white/60">{t('subtitle')}</p>
          <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-3 w-40 bg-white/10" />} renderError={hidden}>
            <Synced />
          </QueryBoundary>

          <p role="note" className="mt-6 mb-8 flex items-start gap-3 rounded-2xl border border-honey-line bg-honey-tint p-4 text-sm text-navy-deep">
            <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-honey" />
            <span>{t('disclaimer')}</span>
          </p>

          <QueryBoundary tone="dark" fallback={<FeaturedSkeleton />}>
            <Featured />
          </QueryBoundary>
        </div>
      </header>
      <QueryBoundary fallback={null} renderError={hidden}>
        <ByGroup />
      </QueryBoundary>
    </>
  );
}

/** The predictions from every stored Tirage (the route prefetches `draws.list`). */
function usePrediction() {
  const trpc = useTRPC();
  const { data: draws } = useSuspenseQuery(trpc.draws.list.queryOptions());
  return useMemo(() => predictNextDraws(draws, new Date()), [draws]);
}

/** « Mis à jour … »: when IRCC's feed was last read. */
function Synced(): ReactNode {
  const t = useTranslations('DrawPrediction');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.draws.latest.queryOptions({ take: 1 }));
  if (!data.lastSyncedAt) return null;
  // Relative to now: the static HTML can be a few minutes behind the browser.
  return <p suppressHydrationWarning className="text-xs text-white/50">{t('synced', { when: format.relativeTime(data.lastSyncedAt, new Date()) })}</p>;
}

function Featured(): ReactNode {
  const t = useTranslations('DrawPrediction');
  const { featured } = usePrediction();
  if (!featured) return <p className="rounded-2xl bg-white/10 p-6 text-white/80">{t('empty')}</p>;
  return <FeaturedPrediction prediction={featured} />;
}

function ByGroup(): ReactNode {
  const { byGroup } = usePrediction();
  return byGroup.length > 0 ? <GroupPredictions predictions={byGroup} /> : null;
}

/** The featured prediction's card, on navy. */
function FeaturedSkeleton(): ReactNode {
  const t = useTranslations('Common');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-80 rounded-3xl bg-white/10 lg:h-64" />
    </div>
  );
}
