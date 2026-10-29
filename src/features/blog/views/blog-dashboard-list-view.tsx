'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Tags } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardListInput, type DashboardStatusFilter } from '@/features/blog/lib/blog-schema';
import { categoryName } from '@/features/blog/lib/category-name';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useTRPC } from '@/trpc/client';

type StatusFilter = DashboardStatusFilter;
const FILTERS: StatusFilter[] = ['ALL', 'DRAFT', 'PUBLISHED'];

const head = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate';
const cell = 'px-4 py-3 align-middle text-sm text-navy-deep';

/** The Blog section's home: every Article, last modified first, filterable by status. */
export function BlogDashboardListView(): ReactNode {
  const t = useTranslations('BlogDashboard');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  // The current list stays on screen while another filter's loads.
  const [, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // The route prefetched « Tous »; fetch the other filters in the background
  // so switching to them is instant.
  useEffect(() => {
    for (const other of FILTERS) {
      void queryClient.prefetchQuery(trpc.blog.dashboard.list.queryOptions(dashboardListInput(other)));
    }
  }, [queryClient, trpc]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/blog/categories"
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep"
          >
            <Tags aria-hidden={true} className="size-4" />
            {t('categoriesLink')}
          </Link>
          <Link
            href="/blog/nouveau"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('newArticle')}
          </Link>
        </div>
      </div>

      <div role="group" aria-label={t('statusFilter')} className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => startTransition(() => setFilter(value))}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {value === 'ALL' ? t('all') : t(`status.${value}`)}
          </button>
        ))}
      </div>

      <QueryBoundary fallback={<ArticleListSkeleton />}>
        <ArticleList filter={filter} />
      </QueryBoundary>
    </div>
  );
}

/** The Articles `filter` keeps: a table on wide screens, cards on phones. */
function ArticleList({ filter }: { filter: StatusFilter }): ReactNode {
  const t = useTranslations('BlogDashboard');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  const { data: posts } = useSuspenseQuery(trpc.blog.dashboard.list.queryOptions(dashboardListInput(filter)));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const statusPill = (status: 'DRAFT' | 'PUBLISHED') => (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
        status === 'PUBLISHED' ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey'
      }`}
    >
      {t(`status.${status}`)}
    </span>
  );

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">{t('empty')}</p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-fog-light bg-white shadow-sm md:block">
        <table className="w-full border-collapse">
          <thead className="border-b border-fog-light bg-off-white">
            <tr>
              <th scope="col" className={head}>{t('columns.title')}</th>
              <th scope="col" className={head}>{t('columns.status')}</th>
              <th scope="col" className={head}>{t('columns.language')}</th>
              <th scope="col" className={head}>{t('columns.category')}</th>
              <th scope="col" className={head}>{t('columns.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-off-white last:border-b-0 hover:bg-off-white">
                <td className={`${cell} font-semibold`}>
                  <Link href={`/blog/${post.id}`} className="hover:text-rouge">
                    {post.title}
                  </Link>
                </td>
                <td className={cell}>{statusPill(post.status)}</td>
                <td className={`${cell} uppercase`}>{post.locale}</td>
                <td className={cell}>{categoryName(post.category, locale)}</td>
                <td className={`${cell} whitespace-nowrap text-slate`}>{date(post.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.id}`}
              className="block rounded-2xl border border-fog-light bg-white p-4 shadow-sm hover:border-navy-deep"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold text-navy-deep">{post.title}</span>
                {statusPill(post.status)}
              </span>
              <span className="mt-2 block text-xs text-slate">
                {categoryName(post.category, locale)} · {post.locale.toUpperCase()} · {date(post.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The list's rows before they arrive. */
function ArticleListSkeleton(): ReactNode {
  const t = useTranslations('BlogDashboard');
  return (
    <div role="status" className="overflow-hidden rounded-2xl border border-fog-light bg-white shadow-sm">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} aria-hidden={true} className="flex items-center gap-4 border-b border-off-white px-4 py-4 last:border-b-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}
