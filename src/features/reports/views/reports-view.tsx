'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { REPORT_STATUSES, type ReportStatus } from '@/features/reports/lib/report-schema';
import { rollbarOccurrenceUrl } from '@/features/reports/lib/rollbar-config';
import { useTRPC } from '@/trpc/client';

type Filter = 'ALL' | ReportStatus;
const FILTERS: readonly Filter[] = ['ALL', ...REPORT_STATUSES];

const BADGE: Record<ReportStatus, string> = {
  NEW: 'bg-blush text-crimson',
  IN_PROGRESS: 'bg-ice-blue text-navy-deep',
  RESOLVED: 'bg-leaf/10 text-leaf',
  IGNORED: 'bg-fog-light text-slate',
};

/** « Signalements » (#160): what Clients and the consultant reported, to flag one by one. */
export function ReportsView(): ReactNode {
  const t = useTranslations('Reports.list');
  const [filter, setFilter] = useState<Filter>('ALL');
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
      <p className="mt-2 mb-6 text-sm text-slate">{t('intro')}</p>
      <div role="group" aria-label={t('filterLabel')} className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {value === 'ALL' ? t('all') : t(`statuses.${value}`)}
          </button>
        ))}
      </div>
      <QueryBoundary fallback={<ReportsSkeleton />}>
        <Reports filter={filter} />
      </QueryBoundary>
    </div>
  );
}

function Reports({ filter }: { filter: Filter }): ReactNode {
  const t = useTranslations('Reports.list');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.reports.list.queryOptions({}));
  const shown = filter === 'ALL' ? data : data.filter((report) => report.status === filter);
  if (shown.length === 0) return <p className="rounded-2xl bg-white p-6 text-sm text-slate">{t('empty')}</p>;
  return (
    <ul className="grid grid-cols-1 gap-4">
      {shown.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </ul>
  );
}

type Report = {
  id: string;
  message: string;
  path: string;
  userAgent: string | null;
  rollbarIds: string[];
  status: ReportStatus;
  createdAt: Date;
  account: { name: string; email: string; role: string };
};

function ReportCard({ report }: { report: Report }): ReactNode {
  const t = useTranslations('Reports.list');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const setStatus = useMutation(
    trpc.reports.setStatus.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.reports.list.queryKey() });
        toast.add({ title: t('updated'), type: 'success' });
      },
      onError: () => toast.add({ title: t('failed'), type: 'error' }),
    }),
  );

  return (
    <li aria-labelledby={`${id}-who`} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-fog-light">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={`${id}-who`} className="font-semibold text-navy-deep">
            {report.account.name}
            <span className="ml-2 text-sm font-normal text-slate">{report.account.email}</span>
          </p>
          <p className="text-xs text-slate">
            {format.dateTime(report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })} · {report.path}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[report.status]}`}>{t(`statuses.${report.status}`)}</span>
      </div>
      <p className="mt-3 text-sm whitespace-pre-line text-navy-deep">{report.message}</p>
      {report.userAgent ? <p className="mt-2 truncate text-xs text-slate">{report.userAgent}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {report.rollbarIds.length > 0 ? (
          <ul aria-label={t('errors')} className="flex flex-wrap gap-2">
            {report.rollbarIds.map((uuid, index) => (
              <li key={uuid}>
                <a
                  href={rollbarOccurrenceUrl(uuid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-off-white px-3 py-1 text-xs font-semibold text-navy-deep hover:bg-ice-blue"
                >
                  {t('error', { number: index + 1 })}
                  <ExternalLink aria-hidden={true} className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate">{t('noErrors')}</p>
        )}
        <label className="flex items-center gap-2 text-sm text-navy-deep">
          <span className="font-semibold">{t('statusLabel')}</span>
          <select
            value={report.status}
            disabled={setStatus.isPending}
            onChange={(event) => setStatus.mutate({ id: report.id, status: event.target.value as ReportStatus })}
            className="h-9 rounded-xl border-2 border-fog-light bg-white px-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
          >
            {REPORT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}

export function ReportsSkeleton(): ReactNode {
  const t = useTranslations('Reports.list');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} aria-hidden={true} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  );
}
