'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useDeferredValue, useId, useState, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ACCOUNT_STATUS_FILTERS,
  ACCOUNTS_SHOWN,
  type AccountStatusFilter,
} from '@/features/accounts/lib/account-schema';
import { useTRPC } from '@/trpc/client';

const head = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate';
const cell = 'px-4 py-3 align-middle text-sm text-navy-deep';

/** « Comptes »: every Account, newest first, by name or email and status (#92). Read-only. */
export function AccountsDashboardView(): ReactNode {
  const t = useTranslations('Accounts');
  const ids = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const [status, setStatus] = useState<AccountStatusFilter>('ALL');
  const [, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor={`${ids}-search`} className="sr-only">
          {t('search')}
        </label>
        <input
          id={`${ids}-search`}
          type="search"
          value={query}
          placeholder={t('search')}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full max-w-sm rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
        />
        <div role="group" aria-label={t('statusLabel')} className="flex flex-wrap gap-2">
          {ACCOUNT_STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => startTransition(() => setStatus(value))}
              className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
            >
              {t(`statuses.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <QueryBoundary fallback={<RowsSkeleton />}>
        <AccountList query={deferred} status={status} />
      </QueryBoundary>
    </div>
  );
}

function AccountList({ query, status }: { query: string; status: AccountStatusFilter }): ReactNode {
  const t = useTranslations('Accounts');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.accounts.dashboard.list.queryOptions({ query, status }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'short', year: 'numeric' });

  if (data.accounts.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">
        {t('empty')}
      </p>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-slate">
        {data.total > ACCOUNTS_SHOWN
          ? t('countLimited', { shown: ACCOUNTS_SHOWN, total: data.total })
          : t('count', { count: data.total })}
      </p>
      <div className="hidden overflow-hidden rounded-2xl border border-fog-light bg-white shadow-sm md:block">
        <table className="w-full border-collapse">
          <thead className="border-b border-fog-light bg-off-white">
            <tr>
              <th scope="col" className={head}>
                {t('columns.name')}
              </th>
              <th scope="col" className={head}>
                {t('columns.status')}
              </th>
              <th scope="col" className={head}>
                {t('columns.signedUp')}
              </th>
              <th scope="col" className={head}>
                {t('columns.language')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((account) => (
              <tr key={account.id} className="border-b border-off-white last:border-b-0 hover:bg-off-white">
                <td className={cell}>
                  <Link href={`/comptes/${account.id}`} className="font-semibold hover:text-rouge">
                    {account.name}
                  </Link>
                  <span className="block text-xs text-slate">{account.email}</span>
                </td>
                <td className={cell}>{t(`statuses.${account.status}`)}</td>
                <td className={`${cell} whitespace-nowrap text-slate`}>{date(account.createdAt)}</td>
                <td className={`${cell} uppercase text-slate`}>{account.locale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:hidden">
        {data.accounts.map((account) => (
          <li key={account.id}>
            <Link
              href={`/comptes/${account.id}`}
              className="block rounded-2xl border border-fog-light bg-white p-4 shadow-sm hover:border-navy-deep"
            >
              <span className="block font-semibold text-navy-deep">{account.name}</span>
              <span className="block text-xs text-slate">{account.email}</span>
              <span className="mt-1 block text-xs text-slate">
                {t(`statuses.${account.status}`)} · {date(account.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** One Account: who it is, its Dossiers, and « Ouvrir un dossier » for it. */
export function AccountDashboardView({ id }: { id: string }): ReactNode {
  const t = useTranslations('Accounts');
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/comptes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
      >
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <QueryBoundary fallback={<RowsSkeleton />}>
        <AccountDetail id={id} />
      </QueryBoundary>
    </div>
  );
}

function AccountDetail({ id }: { id: string }): ReactNode {
  const t = useTranslations('Accounts');
  const dossiers = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: account } = useSuspenseQuery(trpc.accounts.dashboard.get.queryOptions({ id }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-deep">{account.name}</h1>
          <p className="mt-1 text-sm text-slate">
            {account.email} · {t(`statuses.${account.status}`)} · {t('signedUpOn', { date: date(account.createdAt) })} ·{' '}
            <span className="uppercase">{account.locale}</span>
          </p>
        </div>
        <Link
          href={`/dossiers/nouveau?account=${account.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
        >
          <FolderPlus aria-hidden={true} className="size-4" />
          {t('openDossier')}
        </Link>
      </header>
      <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-navy-deep">{t('dossiers')}</h2>
        {account.dossiers.length === 0 ? (
          <p className="mt-2 text-sm text-slate">{t('noDossier')}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {account.dossiers.map((dossier) => (
              <li key={dossier.id}>
                <Link
                  href={`/dossiers/${dossier.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-fog-light px-4 py-3 hover:border-navy-deep"
                >
                  <span className="font-semibold text-navy-deep">{dossiers(`services.${dossier.service}`)}</span>
                  <span className="text-sm text-slate">
                    {dossiers(`stages.${dossier.service}.${dossier.stage}` as never)} ·{' '}
                    {dossiers(`state.${dossier.state === 'CLOSED' ? 'CLOSED' : 'OPEN'}`)} · {date(dossier.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RowsSkeleton(): ReactNode {
  const t = useTranslations('Accounts');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid grid-cols-1 gap-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
