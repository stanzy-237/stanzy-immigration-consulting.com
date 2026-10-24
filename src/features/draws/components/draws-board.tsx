'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DrawAlerts } from '@/features/draws/components/draw-alerts';
import { DrawsHistory } from '@/features/draws/components/draws-history';
import { LatestDrawCard } from '@/features/draws/components/latest-draw-card';
import { api } from '@/trpc/react';

/** The Derniers tirages page body: hero with the latest Tirage, alerts, history. */
export function DrawsBoard(): ReactNode {
  const t = useTranslations('Draws');
  const format = useFormatter();
  const latest = api.draws.latest.useQuery({ take: 1 });
  const list = api.draws.list.useQuery();
  const newest = latest.data?.draws[0];
  const syncedAt = latest.data?.lastSyncedAt;
  const failed = latest.isError || list.isError;

  return (
    <>
      <header className="bg-linear-135 from-navy-deep to-navy-80 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-7">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/30 bg-rouge/15 px-4 py-1.5 font-label font-semibold uppercase text-rose">
            <span aria-hidden={true} className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
            {t('eyebrow')}
          </p>
          <h1 className="mb-2 font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">{t('title')}</h1>
          <p className="mb-2 text-base text-white/60">{t('subtitle')}</p>
          {syncedAt && <p className="mb-8 text-xs text-white/50">{t('synced', { when: format.relativeTime(syncedAt, new Date()) })}</p>}
          {!syncedAt && <div className="mb-8" />}
          {failed && <p role="alert" className="rounded-2xl bg-white/10 p-6 text-white/80">{t('error')}</p>}
          {!failed && !latest.data && <p className="text-white/70">{t('loading')}</p>}
          {!failed && latest.data && !newest && <p className="rounded-2xl bg-white/10 p-6 text-white/80">{t('neverSynced')}</p>}
          {newest && <LatestDrawCard draw={newest} />}
        </div>
      </header>
      <DrawAlerts />
      {list.data && list.data.length > 0 && <DrawsHistory draws={list.data} />}
    </>
  );
}
