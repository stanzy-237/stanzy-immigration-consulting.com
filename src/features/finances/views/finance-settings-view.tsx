'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { toast } from '@/components/ui/toast';
import {
  field,
  FinanceListSkeleton,
  primary,
  secondary,
  useFinancesRefresh,
} from '@/features/finances/components/finance-fields';
import { FinancesHeader } from '@/features/finances/components/finances-header';
import { useFinanceErrors } from '@/features/finances/hooks/use-finance-errors';
import { CATEGORY_MAX } from '@/features/finances/lib/finance-schema';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Category = RouterOutputs['finances']['categories']['list'][number];
type Rate = RouterOutputs['finances']['rates']['list'][number];

/** Finances' Réglages (#95): the Charge categories and the year's CAD rates. */
export function FinanceSettingsView({ year }: { year: number }): ReactNode {
  const t = useTranslations('Finances.settings');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <FinancesHeader page="settings" year={year} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="finance-categories" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
          <h2 id="finance-categories" className="font-heading text-lg font-bold text-navy-deep">
            {t('categories')}
          </h2>
          <p className="mb-4 text-sm text-slate">{t('categoriesIntro')}</p>
          <QueryBoundary fallback={<FinanceListSkeleton />}>
            <Categories />
          </QueryBoundary>
        </section>
        <section aria-labelledby="finance-rates" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
          <h2 id="finance-rates" className="font-heading text-lg font-bold text-navy-deep">
            {t('rates')}
          </h2>
          <p className="mb-4 text-sm text-slate">{t('ratesIntro')}</p>
          <QueryBoundary fallback={<FinanceListSkeleton />}>
            <Rates year={year} />
          </QueryBoundary>
        </section>
      </div>
    </div>
  );
}

function Categories(): ReactNode {
  const t = useTranslations('Finances');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const { data: categories } = useSuspenseQuery(trpc.finances.categories.list.queryOptions());
  const [name, setName] = useState('');
  const create = useMutation(
    trpc.finances.categories.create.mutationOptions({
      onSuccess: () => {
        refresh();
        setName('');
        toast.add({ title: t('toast.categorySaved'), type: 'success' });
      },
      onError: failed,
    }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length >= 2) create.mutate({ name: name.trim() });
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <ul className="grid grid-cols-1 gap-1.5">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={`${ids}-new`} className="sr-only">
          {t('settings.newCategory')}
        </label>
        <input
          id={`${ids}-new`}
          required={true}
          minLength={2}
          maxLength={CATEGORY_MAX}
          value={name}
          placeholder={t('settings.newCategory')}
          onChange={(event) => setName(event.target.value)}
          className={field}
        />
        <button type="submit" disabled={create.isPending} className={`shrink-0 ${primary}`}>
          <Plus aria-hidden={true} className="size-4" />
          {t('settings.add')}
        </button>
      </form>
    </div>
  );
}

function CategoryRow({ category }: { category: Category }): ReactNode {
  const t = useTranslations('Finances');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const saved = (close: boolean) => ({
    onSuccess: () => {
      refresh();
      if (close) setRenaming(false);
      toast.add({ title: t('toast.categorySaved'), type: 'success' as const });
    },
    onError: failed,
  });
  const rename = useMutation(trpc.finances.categories.rename.mutationOptions(saved(true)));
  const archive = useMutation(trpc.finances.categories.archive.mutationOptions(saved(false)));
  const archived = category.archivedAt !== null;

  if (renaming) {
    return (
      <li>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) rename.mutate({ id: category.id, name: name.trim() });
          }}
        >
          <label htmlFor={`${ids}-name`} className="sr-only">
            {t('settings.renameLabel', { name: category.name })}
          </label>
          <input
            id={`${ids}-name`}
            required={true}
            minLength={2}
            maxLength={CATEGORY_MAX}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={field}
          />
          <button type="submit" disabled={rename.isPending} className={`shrink-0 ${primary}`}>
            {t('settings.save')}
          </button>
          <button type="button" onClick={() => setRenaming(false)} className={`shrink-0 ${secondary}`}>
            {t('settings.cancel')}
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-fog-light px-3.5 py-2">
      <span className="min-w-0">
        <span className={`block truncate text-sm font-semibold ${archived ? 'text-slate' : 'text-navy-deep'}`}>
          {category.name}
          {archived ? ` · ${t('settings.archived')}` : ''}
        </span>
        <span className="block text-xs text-slate">{t('settings.count', { count: category._count.charges })}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          aria-label={t('settings.renameAction', { name: category.name })}
          className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
        >
          <Pencil aria-hidden={true} className="size-4" />
        </button>
        <button
          type="button"
          disabled={archive.isPending}
          onClick={() => archive.mutate({ id: category.id, archived: !archived })}
          aria-label={t(archived ? 'settings.restoreAction' : 'settings.archiveAction', { name: category.name })}
          className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white disabled:opacity-50"
        >
          {archived ? (
            <ArchiveRestore aria-hidden={true} className="size-4" />
          ) : (
            <Archive aria-hidden={true} className="size-4" />
          )}
        </button>
      </span>
    </li>
  );
}

function Rates({ year }: { year: number }): ReactNode {
  const trpc = useTRPC();
  const { data: rates } = useSuspenseQuery(trpc.finances.rates.list.queryOptions({ year }));
  return (
    <ul className="grid grid-cols-1 gap-1.5">
      {rates.map((rate) => (
        <RateRow key={`${rate.month}-${rate.xafPerCad ?? ''}`} rate={rate} />
      ))}
    </ul>
  );
}

/** One month's rate: typed, saved or cleared on its own. */
function RateRow({ rate }: { rate: Rate }): ReactNode {
  const t = useTranslations('Finances');
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const [value, setValue] = useState(rate.xafPerCad === null ? '' : String(rate.xafPerCad));
  const [invalid, setInvalid] = useState(false);
  const month = format.dateTime(new Date(`${rate.month}-01T00:00:00Z`), { month: 'long', timeZone: 'UTC' });
  const set = useMutation(
    trpc.finances.rates.set.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.rateSaved'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const clear = useMutation(
    trpc.finances.rates.clear.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.rateCleared'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const missing = rate.used && rate.xafPerCad === null;

  return (
    <li>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const number = Number(value.replace(/\s/g, '').replace(',', '.'));
          const ok = Number.isFinite(number) && number > 0;
          setInvalid(!ok);
          if (ok) set.mutate({ month: rate.month, xafPerCad: number });
        }}
      >
        <label htmlFor={`${ids}-rate`} className="w-28 text-sm font-semibold text-navy-deep capitalize">
          {month}
        </label>
        <input
          id={`${ids}-rate`}
          inputMode="decimal"
          value={value}
          aria-label={t('settings.rateLabel', { month })}
          aria-invalid={invalid || missing}
          aria-describedby={invalid || missing ? `${ids}-hint` : undefined}
          onChange={(event) => setValue(event.target.value)}
          className={`w-32 ${field}`}
        />
        <button type="submit" disabled={set.isPending || value.trim() === ''} className={secondary}>
          {t('settings.rateSave')}
        </button>
        {rate.xafPerCad !== null ? (
          <button
            type="button"
            disabled={clear.isPending}
            onClick={() => clear.mutate({ month: rate.month })}
            className="text-sm font-semibold text-rouge hover:text-crimson disabled:opacity-50"
          >
            {t('settings.rateClear')}
          </button>
        ) : null}
        {invalid || missing ? (
          <p id={`${ids}-hint`} className="w-full text-xs text-crimson">
            {invalid ? t('settings.invalidRate') : t('settings.needed')}
          </p>
        ) : null}
      </form>
    </li>
  );
}
