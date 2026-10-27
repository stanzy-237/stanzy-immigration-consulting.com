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

/** Columns left out on phones: the date moves under the type, invitations go. */
const DESKTOP_ONLY = new Set<SortField>(['date', 'invitations']);
const FILTERS: GroupFilter[] = ['ALL', ...DRAW_GROUPS];

/** Cut-off colour: high is hard to reach, low is within reach. */
const crsClass = (crs: number) => (crs >= 700 ? 'text-rouge' : crs >= 450 ? 'text-warning' : 'text-success');

const pageButton =
  'flex size-8 items-center justify-center rounded-lg border border-fog-light bg-white text-xs text-slate transition-colors hover:border-navy-deep disabled:cursor-not-allowed disabled:opacity-40 sm:size-9 sm:text-sm';

const cell = 'px-2.5 py-3 sm:px-5 sm:py-3.5';

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
    <section aria-labelledby={titleId} className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-10">
      <div className="mb-4 flex items-baseline justify-between gap-3 sm:mb-5">
        <h2 id={titleId} className="font-heading text-xl font-bold text-navy-deep sm:text-2xl">
          {t('title')}
        </h2>
        <p className="shrink-0 text-xs text-slate sm:text-sm">{t('count', { count: total })}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-center">
        <label className="relative min-w-52 flex-1">
          <Search aria-hidden={true} className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input
            type="search"
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={state.query}
            onChange={(event) => dispatch({ type: 'search', query: event.target.value })}
            className="h-10 w-full rounded-lg border border-fog-light bg-white pl-11 pr-4 text-sm sm:h-11 text-navy-deep outline-none placeholder:text-slate-mute focus:border-rouge focus:ring-3 focus:ring-rouge/10"
          />
        </label>
        {/* One sideways-scrolling row on phones; wraps from `sm` up. */}
        <div
          role="group"
          aria-label={t('filterLabel')}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {FILTERS.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={state.group === group}
              onClick={() => dispatch({ type: 'filter', group })}
              className={cn(
                'h-8 shrink-0 rounded-full border-2 px-3 text-xs font-semibold transition-colors sm:h-9 sm:px-4',
                state.group === group
                  ? 'border-navy-deep bg-navy-deep text-white'
                  : 'border-fog-light bg-white text-slate hover:border-navy-deep',
              )}
            >
              {tGroups(group)}
            </button>
          ))}
        </div>
        <label className="hidden items-center gap-2 text-sm text-slate sm:flex lg:ml-auto">
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
          <table className="w-full border-collapse text-left sm:min-w-xl">
            <thead className="border-b border-fog-light bg-off-white">
              <tr>
                {COLUMNS.map((field) => {
                  const active = state.sort === field;
                  return (
                    <th
                      key={field}
                      scope="col"
                      aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(cell, DESKTOP_ONLY.has(field) && 'hidden sm:table-cell')}
                    >
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'sort', field })}
                        aria-label={t(`columns.${field}`)}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-label font-semibold uppercase tracking-wider text-slate hover:text-navy-deep sm:gap-1.5"
                      >
                        <span aria-hidden={true} className="sm:hidden">
                          {t(`columnsShort.${field}`)}
                        </span>
                        <span aria-hidden={true} className="hidden sm:inline">
                          {t(`columns.${field}`)}
                        </span>
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
                    <td className={cn(cell, 'whitespace-nowrap text-sm text-navy-deep')}>
                      <span className="font-heading font-bold">#{draw.round}</span>
                      {/* On phones the row's tint is enough to mark it. */}
                      {isNew && (
                        <span className="ml-2 hidden rounded-full border border-rose bg-blush px-2 py-0.5 text-xs font-semibold text-rouge sm:inline-block">
                          {t('new')}
                        </span>
                      )}
                    </td>
                    <td className={cn(cell, 'hidden whitespace-nowrap text-sm text-navy-deep sm:table-cell')}>{text.date(draw)}</td>
                    <td className={cell}>
                      <DrawTypePill
                        group={draw.group}
                        label={text.type(draw)}
                        // In a word or an acronym (« PCP », « Métiers »), as on the home page.
                        shortLabel={text.shortType(draw)}
                        title={draw.typeLabel}
                      />
                      {/* Phones hide the date and invitations columns; they ride under the type. */}
                      <span className="mt-1 block text-xs text-slate sm:hidden">
                        {t('phoneLine', { date: text.date(draw), count: format.number(draw.invitations) })}
                      </span>
                    </td>
                    <td className={cn(cell, 'hidden text-sm font-semibold text-navy-deep sm:table-cell')}>
                      {format.number(draw.invitations)}
                    </td>
                    <td className={cn(cell, 'font-heading text-sm font-bold sm:text-base', crsClass(draw.crsMin))}>{draw.crsMin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total === 0 && (
            <div className="p-8 text-center sm:p-14">
              <p className="font-heading text-base font-bold text-navy-deep sm:text-lg">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-slate sm:text-sm">{t('emptyText')}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-off-white px-3 py-3 text-xs text-slate sm:flex-row sm:justify-between sm:px-5 sm:py-4 sm:text-sm">
          <p>{t('range', { from: total === 0 ? 0 : start + 1, to: start + rows.length, total })}</p>
          <nav aria-label={t('pagination')} className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => dispatch({ type: 'page', page: page - 1 })}
              aria-label={t('previous')}
              className={cn(pageButton, 'sm:w-auto sm:gap-1 sm:px-2.5')}
            >
              <ChevronLeft aria-hidden={true} className="size-3.5" />
              <span aria-hidden={true} className="hidden sm:inline">
                {t('previous')}
              </span>
            </button>
            {pageWindow(page, pageCount).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} aria-hidden={true} className="flex size-8 items-center justify-center sm:size-9">
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
              aria-label={t('next')}
              className={cn(pageButton, 'sm:w-auto sm:gap-1 sm:px-2.5')}
            >
              <span aria-hidden={true} className="hidden sm:inline">
                {t('next')}
              </span>
              <ChevronRight aria-hidden={true} className="size-3.5" />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
