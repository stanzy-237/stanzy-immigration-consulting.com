'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, FileText, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
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

/** The Tableau de bord's home: each section at a glance, starting with the Blog. */
export function DashboardOverviewView(): ReactNode {
  const t = useTranslations('Dashboard');
  const blogId = useId();

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
    </div>
  );
}
