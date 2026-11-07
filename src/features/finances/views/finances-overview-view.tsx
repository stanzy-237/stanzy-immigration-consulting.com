'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { FinancesHeader } from '@/features/finances/components/finances-header';
import { formatMoney } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

/** Finances' Vue d'ensemble (#95): the year in FCFA, per month, service and category, and each Dossier's margin. */
export function FinancesOverviewView({ year }: { year: number }): ReactNode {
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <FinancesHeader page="overview" year={year} />
      <QueryBoundary fallback={<OverviewSkeleton />}>
        <Overview year={year} />
      </QueryBoundary>
    </div>
  );
}

function Overview({ year }: { year: number }): ReactNode {
  const t = useTranslations('Finances.overview');
  const services = useTranslations('Dossiers.services');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.finances.overview.queryOptions({ year }));
  const { report, margins } = data;
  const xaf = (amount: number) => formatMoney(amount, 'XAF', locale);
  const monthName = (index: number) => format.dateTime(new Date(Date.UTC(year, index, 1)), { month: 'long', timeZone: 'UTC' });
  const months = report.missingRates.map((month) =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      {months.length > 0 ? (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-2xl bg-honey-tint px-4 py-3 text-sm text-honey">
          <AlertTriangle aria-hidden={true} className="size-4 shrink-0" />
          {t('missingRates', { months: months.join(', ') })}
          <Link href={`/finances/reglages?annee=${year}`} className="font-semibold underline">
            {t('setRates')}
          </Link>
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t('income')} value={xaf(report.total.income)} />
        <Stat label={t('charges')} value={xaf(report.total.charges)} />
        <Stat label={t('net')} value={xaf(report.total.net)} negative={report.total.net < 0} />
      </dl>

      <section aria-labelledby="finances-months" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <h2 id="finances-months" className="mb-3 font-heading text-lg font-bold text-navy-deep">
          {t('months')}
        </h2>
        <AmountRows
          rows={report.months.map((month, index) => ({
            key: String(index),
            label: <span className="capitalize">{monthName(index)}</span>,
            income: xaf(month.income),
            charges: xaf(month.charges),
            net: xaf(month.net),
            negative: month.net < 0,
          }))}
          names={{ income: t('income'), charges: t('charges'), net: t('net') }}
        />
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-fog-light text-left text-xs text-slate">
                <th scope="col" className="py-2 font-semibold">
                  {t('month')}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                  {t('income')}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                  {t('charges')}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                  {t('net')}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((month, index) => (
                <tr key={index} className="border-b border-fog-light last:border-0">
                  <th scope="row" className="py-2 text-left font-normal text-navy-deep capitalize">
                    {monthName(index)}
                  </th>
                  <td className="py-2 pl-4 text-right whitespace-nowrap text-navy-deep tabular-nums">{xaf(month.income)}</td>
                  <td className="py-2 pl-4 text-right whitespace-nowrap text-navy-deep tabular-nums">{xaf(month.charges)}</td>
                  <td
                    className={`py-2 pl-4 text-right font-semibold whitespace-nowrap tabular-nums ${month.net < 0 ? 'text-crimson' : 'text-navy-deep'}`}
                  >
                    {xaf(month.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Breakdown
          id="finances-services"
          title={t('byService')}
          empty={t('nothing', { year })}
          rows={report.byService.map((row) => ({
            key: row.service ?? 'other',
            label: row.service ? services(row.service) : t('otherSource'),
            amount: xaf(row.income),
          }))}
        />
        <Breakdown
          id="finances-categories"
          title={t('byCategory')}
          empty={t('nothing', { year })}
          rows={report.byCategory.map((row) => ({ key: row.category, label: row.category, amount: xaf(row.charges) }))}
        />
      </div>

      <section aria-labelledby="finances-margins" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <h2 id="finances-margins" className="font-heading text-lg font-bold text-navy-deep">
          {t('margins')}
        </h2>
        <p className="mb-3 text-sm text-slate">{t('marginsIntro')}</p>
        {margins.length === 0 ? (
          <p className="text-sm text-slate">{t('noMargins')}</p>
        ) : (
          <>
            <AmountRows
              rows={margins.map((row) => ({
                key: row.dossierId,
                label: (
                  <>
                    <Link href={`/dossiers/${row.dossierId}`} className="font-semibold text-navy-deep hover:text-rouge">
                      {row.dossier.account.name}
                    </Link>
                    <span className="block text-xs text-slate">{services(row.dossier.service)}</span>
                  </>
                ),
                income: xaf(row.income),
                charges: xaf(row.charges),
                net: xaf(row.net),
                negative: row.net < 0,
              }))}
              names={{ income: t('income'), charges: t('charges'), net: t('margin') }}
            />
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b border-fog-light text-left text-xs text-slate">
                    <th scope="col" className="py-2 font-semibold">
                      {t('dossier')}
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                      {t('income')}
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                      {t('charges')}
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">
                      {t('margin')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {margins.map((row) => (
                    <tr key={row.dossierId} className="border-b border-fog-light last:border-0">
                      <th scope="row" className="py-2 text-left font-normal">
                        <Link
                          href={`/dossiers/${row.dossierId}`}
                          className="font-semibold text-navy-deep hover:text-rouge"
                        >
                          {row.dossier.account.name}
                        </Link>
                        <span className="block text-xs text-slate">{services(row.dossier.service)}</span>
                      </th>
                      <td className="py-2 pl-4 text-right whitespace-nowrap text-navy-deep tabular-nums">{xaf(row.income)}</td>
                      <td className="py-2 pl-4 text-right whitespace-nowrap text-navy-deep tabular-nums">{xaf(row.charges)}</td>
                      <td
                        className={`py-2 pl-4 text-right font-semibold whitespace-nowrap tabular-nums ${row.net < 0 ? 'text-crimson' : 'text-navy-deep'}`}
                      >
                        {xaf(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, negative = false }: { label: string; value: string; negative?: boolean }): ReactNode {
  return (
    <div className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <dt className="text-xs font-semibold text-slate">{label}</dt>
      <dd className={`mt-1 font-heading text-xl font-bold tabular-nums ${negative ? 'text-crimson' : 'text-navy-deep'}`}>
        {value}
      </dd>
    </div>
  );
}

function Breakdown({
  id,
  title,
  empty,
  rows,
}: {
  id: string;
  title: string;
  empty: string;
  rows: { key: string; label: string; amount: string }[];
}): ReactNode {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <h2 id={id} className="mb-3 font-heading text-lg font-bold text-navy-deep">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-navy-deep">{row.label}</span>
              <span className="shrink-0 font-semibold text-navy-deep tabular-nums">{row.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OverviewSkeleton(): ReactNode {
  const t = useTranslations('Finances');
  return (
    <div role="status" className="grid grid-cols-1 gap-6">
      <span className="sr-only">{t('loading')}</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} aria-hidden={true} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}

/** On a phone, a table's rows as small cards: what the row is, then its three amounts, each named. */
function AmountRows({
  rows,
  names,
}: {
  rows: { key: string; label: ReactNode; income: string; charges: string; net: string; negative: boolean }[];
  names: { income: string; charges: string; net: string };
}): ReactNode {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.key} className="rounded-xl bg-off-white px-3 py-2.5 text-sm">
          <div className="text-navy-deep">{row.label}</div>
          <dl className="mt-1.5 grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <dt className="text-xs text-slate">{names.income}</dt>
              <dd className="truncate text-navy-deep tabular-nums">{row.income}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate">{names.charges}</dt>
              <dd className="truncate text-navy-deep tabular-nums">{row.charges}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-xs text-slate">{names.net}</dt>
              <dd className={`truncate font-semibold tabular-nums ${row.negative ? 'text-crimson' : 'text-navy-deep'}`}>
                {row.net}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
