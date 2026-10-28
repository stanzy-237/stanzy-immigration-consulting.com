'use client';

import { Plus, Tags } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { categoryName } from '@/features/blog/lib/category-name';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { api } from '@/trpc/react';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';
const FILTERS: StatusFilter[] = ['ALL', 'DRAFT', 'PUBLISHED'];

const head = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate';
const cell = 'px-4 py-3 align-middle text-sm text-navy-deep';

/** The Blog section's home: every Article, last modified first, filterable by status. */
export function BlogDashboardListView(): ReactNode {
  const t = useTranslations('BlogDashboard');
  const format = useFormatter();
  const locale = useLocale();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const list = api.blog.dashboard.list.useQuery(filter === 'ALL' ? {} : { status: filter });
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
            onClick={() => setFilter(value)}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {value === 'ALL' ? t('all') : t(`status.${value}`)}
          </button>
        ))}
      </div>

      {list.isError && <p role="alert" className="rounded-2xl bg-white p-6 text-slate">{t('error')}</p>}
      {list.isLoading && <p className="text-slate">{t('loading')}</p>}
      {list.data?.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">{t('empty')}</p>
      )}

      {list.data && list.data.length > 0 && (
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
                {list.data.map((post) => (
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
            {list.data.map((post) => (
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
      )}
    </div>
  );
}
