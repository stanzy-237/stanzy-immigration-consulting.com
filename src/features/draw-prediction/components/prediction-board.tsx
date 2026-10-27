'use client';

import { Info } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { FeaturedPrediction } from '@/features/draw-prediction/components/featured-prediction';
import { GroupPredictions } from '@/features/draw-prediction/components/group-predictions';
import { predictNextDraws } from '@/features/draw-prediction/lib/predict-next-draws';
import { api } from '@/trpc/react';

/**
 * The Prochain tirage page body: hero with the most likely next Tirage, the
 * « estimation, pas une garantie » warning, then every active group. Computed
 * in the browser from `draws.list`, so it follows each new Tirage by itself.
 */
export function PredictionBoard(): ReactNode {
  const t = useTranslations('DrawPrediction');
  const format = useFormatter();
  const list = api.draws.list.useQuery();
  // Only for « Mis à jour … »: when IRCC's feed was last read.
  const latest = api.draws.latest.useQuery({ take: 1 });
  const syncedAt = latest.data?.lastSyncedAt;
  const prediction = useMemo(() => (list.data ? predictNextDraws(list.data, new Date()) : null), [list.data]);

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
          {syncedAt && <p className="text-xs text-white/50">{t('synced', { when: format.relativeTime(syncedAt, new Date()) })}</p>}

          <p role="note" className="mt-6 mb-8 flex items-start gap-3 rounded-2xl border border-honey-line bg-honey-tint p-4 text-sm text-navy-deep">
            <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-honey" />
            <span>{t('disclaimer')}</span>
          </p>

          {list.isError && <p role="alert" className="rounded-2xl bg-white/10 p-6 text-white/80">{t('error')}</p>}
          {!list.isError && !prediction && <p className="text-white/70">{t('loading')}</p>}
          {prediction && !prediction.featured && <p className="rounded-2xl bg-white/10 p-6 text-white/80">{t('empty')}</p>}
          {prediction?.featured && <FeaturedPrediction prediction={prediction.featured} />}
        </div>
      </header>
      {prediction && prediction.byGroup.length > 0 && <GroupPredictions predictions={prediction.byGroup} />}
    </>
  );
}
