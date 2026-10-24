'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useReducer, type ReactNode } from 'react';

import { DrawTypePill } from '@/features/draws/components/draw-type-pill';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';
import {
  INITIAL_TABLE,
  pageWindow,
  PER_PAGE_OPTIONS,
  selectRows,
  tableReducer,
  type GroupFilter,
  type SortField,
} from '@/features/draws/lib/draws-table';
import { DRAW_GROUPS } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';
import { cn } from '@/lib/utils';

const COLUMNS: SortField[] = ['round', 'date', 'type', 'invitations', 'crsMin'];
const FILTERS: GroupFilter[] = ['ALL', ...DRAW_GROUPS];

/** Cut-off colour: high is hard to reach, low is within reach. */
const crsClass = (crs: number) => (crs >= 700 ? 'text-rouge' : crs >= 450 ? 'text-warning' : 'text-success');

const pageButton =
  'flex size-9 items-center justify-center rounded-lg border border-fog-light bg-white text-sm text-slate transition-colors hover:border-navy-deep disabled:cursor-not-allowed disabled:opacity-40';

/** "Historique des tirages": every stored round, searchable, filterable, sortable and paged. */
export function DrawsHistory({ draws }: { draws: DrawSummary[] }): ReactNode {
  const t = useTranslations('Draws.history');
  const tGroups = useTranslations('Draws.groups');
  const format = useFormatter();
  const text = useDrawText();
  const titleId = useId();
  const [state, dispatch] = useReducer(tableReducer, INITIAL_TABLE);
  const { rows, total, page, pageCount, start } = selectRows(draws, state, text);
  const newest = draws[0]?.round;

  return (
    <section aria-labelledby={titleId} className="mx-auto max-w-7xl px-4 py-10 sm:px-7">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 id={titleId} className="font-heading text-2xl font-bold text-navy-deep">
          {t('title')}
        </h2>
        <p className="text-sm text-slate">{t('count', { count: total })}</p>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-52 flex-1">
          <Search aria-hidden={true} className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input
            type="search"
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={state.query}
            onChange={(event) => dispatch({ type: 'search', query: event.target.value })}
            className="h-11 w-full rounded-lg border border-fog-light bg-white pl-11 pr-4 text-sm text-navy-deep outline-none placeholder:text-slate-mute focus:border-rouge focus:ring-3 focus:ring-rouge/10"
          />
        </label>
        <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
          {FILTERS.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={state.group === group}
              onClick={() => dispatch({ type: 'filter', group })}
              className={cn(
                'h-9 rounded-full border-2 px-4 font-label font-medium transition-colors',
                state.group === group
                  ? 'border-navy-deep bg-navy-deep text-white'
                  : 'border-fog-light bg-white text-slate hover:border-navy-deep',
              )}
            >
              {tGroups(group)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate lg:ml-auto">
          <span aria-hidden={true}>{t('perPage')}</span>
          <select
            aria-label={t('perPageLabel')}
            value={state.perPage}
            onChange={(event) => dispatch({ type: 'perPage', perPage: Number(event.target.value) })}
            className="h-9 rounded-lg border border-fog-light bg-white px-3 text-sm font-medium text-navy-deep outline-none focus:border-rouge"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-fog-light bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl border-collapse text-left">
            <thead className="border-b border-fog-light bg-off-white">
              <tr>
                {COLUMNS.map((field) => {
                  const active = state.sort === field;
                  return (
                    <th
                      key={field}
                      scope="col"
                      aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className="px-5 py-3.5"
                    >
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'sort', field })}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap font-label font-semibold uppercase tracking-widest text-slate hover:text-navy-deep"
                      >
                        {t(`columns.${field}`)}
                        <span aria-hidden={true} className="flex flex-col text-fog">
                          <ArrowUp className={cn('-mb-1 size-2.5', active && state.dir === 'asc' && 'text-navy-deep')} />
                          <ArrowDown className={cn('size-2.5', active && state.dir === 'desc' && 'text-navy-deep')} />
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((draw) => {
                const isNew = draw.round === newest;
                return (
                  <tr key={draw.round} className={cn('border-b border-off-white', isNew ? 'bg-blush' : 'hover:bg-off-white')}>
                    <td className="px-5 py-3.5 text-sm text-navy-deep">
                      <span className="font-heading font-bold">#{draw.round}</span>
                      {isNew && (
                        <span className="ml-2 inline-block rounded-full border border-rose bg-blush px-2 py-0.5 font-label text-xs font-semibold text-rouge">
                          {t('new')}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-navy-deep">{text.date(draw)}</td>
                    <td className="px-5 py-3.5">
                      <DrawTypePill group={draw.group} label={text.type(draw)} title={draw.typeLabel} />
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-navy-deep">{format.number(draw.invitations)}</td>
                    <td className={cn('px-5 py-3.5 font-heading text-base font-bold', crsClass(draw.crsMin))}>{draw.crsMin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total === 0 && (
            <div className="p-14 text-center">
              <p className="font-heading text-lg font-bold text-navy-deep">{t('emptyTitle')}</p>
              <p className="mt-1 text-sm text-slate">{t('emptyText')}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-off-white px-5 py-4 text-sm text-slate">
          <p>{t('range', { from: total === 0 ? 0 : start + 1, to: start + rows.length, total })}</p>
          <nav aria-label={t('pagination')} className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => dispatch({ type: 'page', page: page - 1 })}
              className={cn(pageButton, 'w-auto gap-1 px-2.5')}
            >
              <ChevronLeft aria-hidden={true} className="size-3.5" /> {t('previous')}
            </button>
            {pageWindow(page, pageCount).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} aria-hidden={true} className="flex size-9 items-center justify-center">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-label={t('page', { page: n })}
                  aria-current={n === page ? 'page' : undefined}
                  onClick={() => dispatch({ type: 'page', page: n })}
                  className={cn(pageButton, n === page && 'border-navy-deep bg-navy-deep font-bold text-white')}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => dispatch({ type: 'page', page: page + 1 })}
              className={cn(pageButton, 'w-auto gap-1 px-2.5')}
            >
              {t('next')} <ChevronRight aria-hidden={true} className="size-3.5" />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
