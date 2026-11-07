'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceStatusPill } from '@/features/invoices/components/invoice-status-pill';
import { INVOICE_FILTERS, type InvoiceFilter } from '@/features/invoices/lib/invoice-schema';
import { formatMoney } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

const head = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate';
const cell = 'px-4 py-3 align-middle text-sm text-navy-deep';

/** The Factures section's home: every invoice, last changed first, filterable by status. */
export function InvoicesDashboardListView(): ReactNode {
  const t = useTranslations('Invoices.list');
  const [filter, setFilter] = useState<InvoiceFilter>('ALL');
  // The current list stays on screen while another filter's loads.
  const [, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // The route prefetched « Toutes »; fetch the others so switching is instant.
  useEffect(() => {
    for (const value of INVOICE_FILTERS) {
      void queryClient.prefetchQuery(trpc.invoices.dashboard.list.queryOptions({ filter: value }));
    }
  }, [queryClient, trpc]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate">{t('intro')}</p>
        </div>
        <Link
          href="/factures/nouvelle"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
        >
          <Plus aria-hidden={true} className="size-4" />
          {t('new')}
        </Link>
      </div>

      <div role="group" aria-label={t('filtersLabel')} className="mb-5 flex flex-wrap gap-2">
        {INVOICE_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => startTransition(() => setFilter(value))}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {t(`filters.${value}`)}
          </button>
        ))}
      </div>

      <QueryBoundary fallback={<InvoiceListSkeleton />}>
        <InvoiceList filter={filter} />
      </QueryBoundary>
    </div>
  );
}

/** The invoices `filter` keeps: a table on wide screens, cards on phones. */
function InvoiceList({ filter }: { filter: InvoiceFilter }): ReactNode {
  const t = useTranslations('Invoices');
  const services = useTranslations('Dossiers.services');
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: invoices } = useSuspenseQuery(trpc.invoices.dashboard.list.queryOptions({ filter }));
  const due = (value: Date | null) =>
    value ? format.dateTime(value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

  if (invoices.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">
        {t('list.empty')}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-fog-light bg-white shadow-sm md:block">
        <table className="w-full border-collapse">
          <thead className="border-b border-fog-light bg-off-white">
            <tr>
              <th scope="col" className={head}>
                {t('pdf.number')}
              </th>
              <th scope="col" className={head}>
                {t('pdf.billedTo')}
              </th>
              <th scope="col" className={`${head} text-right`}>
                {t('pdf.total')}
              </th>
              <th scope="col" className={head}>
                {t('pdf.dueDate')}
              </th>
              <th scope="col" className={head}>
                <span className="sr-only">{t('list.status')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-off-white last:border-b-0 hover:bg-off-white">
                <td className={cell}>
                  <Link href={`/factures/${invoice.id}`} className="font-semibold hover:text-rouge">
                    {invoice.number ?? t('list.draft')}
                  </Link>
                </td>
                <td className={cell}>
                  {invoice.dossier.account.name}
                  <span className="block text-xs text-slate">{services(invoice.dossier.service)}</span>
                </td>
                <td className={`${cell} text-right font-semibold whitespace-nowrap`}>
                  {formatMoney(invoice.total, invoice.currency, locale)}
                </td>
                <td className={`${cell} whitespace-nowrap text-slate`}>{due(invoice.dueDate)}</td>
                <td className={cell}>
                  <InvoiceStatusPill invoice={invoice} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              href={`/factures/${invoice.id}`}
              className="block rounded-2xl border border-fog-light bg-white p-4 shadow-sm hover:border-navy-deep"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold text-navy-deep">{invoice.number ?? t('list.draft')}</span>
                <InvoiceStatusPill invoice={invoice} />
              </span>
              <span className="mt-1 block text-sm text-navy-deep">{invoice.dossier.account.name}</span>
              <span className="mt-1 block text-sm font-semibold text-navy-deep">
                {formatMoney(invoice.total, invoice.currency, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function InvoiceListSkeleton(): ReactNode {
  const t = useTranslations('Invoices.list');
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
