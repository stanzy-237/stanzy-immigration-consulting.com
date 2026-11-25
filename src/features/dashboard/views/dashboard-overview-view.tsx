'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, FileText, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** The Blog's counts and its last published Article. */
function BlogSummary(): ReactNode {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.blog.dashboard.summary.queryOptions());

  return (
    <>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        <li className="rounded-xl bg-off-white px-4 py-3 font-heading text-lg font-bold text-navy-deep">
          {t('overview.drafts', { count: data.drafts })}
        </li>
        <li className="rounded-xl bg-off-white px-4 py-3 font-heading text-lg font-bold text-navy-deep">
          {t('overview.published', { count: data.published })}
        </li>
      </ul>
      <p className="mt-4 text-sm text-slate">
        {data.lastPublished
          ? t('overview.lastPublished', {
              title: data.lastPublished.title,
              date: format.dateTime(data.lastPublished.publishedAt, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }),
            })
          : t('overview.noneYet')}
      </p>
    </>
  );
}

function BlogSummarySkeleton(): ReactNode {
  const t = useTranslations('Dashboard');
  return (
    <div role="status">
      <span className="sr-only">{t('overview.loading')}</span>
      <div aria-hidden={true} className="mt-5 grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton aria-hidden={true} className="mt-4 h-4 w-2/3" />
    </div>
  );
}

/**
 * « Tirages IRCC »: when IRCC's feed was last read, the newest Tirage, and
 * « Actualiser maintenant », the daily refresh run at once.
 */
function DrawsSync(): ReactNode {
  const t = useTranslations('Dashboard.overview.draws');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.draws.sync.queryOptions());
  const refresh = useMutation(
    trpc.draws.refresh.mutationOptions({
      onSuccess: async (report) => {
        await queryClient.invalidateQueries({ queryKey: trpc.draws.sync.queryKey() });
        toast.add({
          title: report.inserted > 0 ? t('found', { count: report.inserted }) : t('nothingNew'),
          description: report.alerted > 0 ? t('alerted', { count: report.alerted }) : undefined,
          type: 'success',
        });
      },
      onError: () => toast.add({ title: t('failed'), type: 'error' }),
    }),
  );

  return (
    <>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-off-white px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-slate uppercase">{t('lastRead')}</dt>
          <dd className="mt-1 font-heading text-lg font-bold text-navy-deep">
            {data.lastSyncedAt ? format.relativeTime(data.lastSyncedAt, now) : t('never')}
          </dd>
        </div>
        <div className="rounded-xl bg-off-white px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-slate uppercase">{t('newest')}</dt>
          <dd className="mt-1 font-heading text-lg font-bold text-navy-deep">
            {data.newest
              ? t('newestValue', {
                  round: data.newest.round,
                  date: format.dateTime(data.newest.date, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
                  crs: data.newest.crsMin,
                })
              : t('none')}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{t('schedule')}</p>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-navy-deep px-5 text-sm font-semibold text-navy-deep hover:bg-ice-blue disabled:opacity-60"
        >
          <RefreshCw aria-hidden={true} className={cn('size-4', refresh.isPending && 'animate-spin motion-reduce:animate-none')} />
          {refresh.isPending ? t('refreshing') : t('refresh')}
        </button>
      </div>
    </>
  );
}

function DrawsSyncSkeleton(): ReactNode {
  const t = useTranslations('Dashboard');
  return (
    <div role="status">
      <span className="sr-only">{t('overview.loading')}</span>
      <div aria-hidden={true} className="mt-5 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-18 rounded-xl" />
        <Skeleton className="h-18 rounded-xl" />
      </div>
      <Skeleton aria-hidden={true} className="mt-4 h-11 w-52 rounded-full" />
    </div>
  );
}

/** The Tableau de bord's home: each section at a glance, starting with the Blog. */
export function DashboardOverviewView(): ReactNode {
  const t = useTranslations('Dashboard');
  const blogId = useId();
  const drawsId = useId();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('nav.overview')}</h1>
      <p className="mt-1 text-sm text-slate">{t('overview.subtitle')}</p>

      <section aria-labelledby={blogId} className="mt-8 rounded-2xl border border-fog-light bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={blogId} className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
            <FileText aria-hidden={true} className="size-5 text-rouge" />
            {t('overview.blogTitle')}
          </h2>
          <Link
            href="/blog/nouveau"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('overview.newArticle')}
          </Link>
        </div>

        <QueryBoundary fallback={<BlogSummarySkeleton />}>
          <BlogSummary />
        </QueryBoundary>

        <Link
          href="/blog"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-rouge hover:text-crimson"
        >
          {t('overview.allArticles')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </Link>
      </section>

      <section aria-labelledby={drawsId} className="mt-6 rounded-2xl border border-fog-light bg-white p-5 shadow-sm sm:p-6">
        <h2 id={drawsId} className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
          <TrendingUp aria-hidden={true} className="size-5 text-rouge" />
          {t('overview.draws.title')}
        </h2>
        <QueryBoundary fallback={<DrawsSyncSkeleton />}>
          <DrawsSync />
        </QueryBoundary>
      </section>
    </div>
  );
}
