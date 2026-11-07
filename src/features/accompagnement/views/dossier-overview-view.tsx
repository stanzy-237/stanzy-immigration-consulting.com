'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarClock, Gauge } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { itaDeadline, timeLeft, utcDate } from '@/features/ita-countdown/lib/ita-deadline';
import { URGENCY_CLASSES, urgencyOf } from '@/features/ita-countdown/lib/urgency';
import { useTRPC } from '@/trpc/client';

const card = 'rounded-2xl border border-fog-light bg-white p-5 shadow-sm';
const BAR: Record<keyof typeof URGENCY_CLASSES, string> = { calm: 'bg-leaf', soon: 'bg-honey', urgent: 'bg-rouge' };

/**
 * The top of an Accompagnement Dossier's Aperçu (#81), for the Client and the
 * consultant: the CRS score its Demande d'intérêt gave, and from the ITA's
 * day the days left of the 60 to submit the demande de résidence permanente.
 * The consultant sets that day when the ITA comes later. Nothing for any
 * other service.
 */
export function DossierOverviewView({
  dossierId,
  viewer,
}: {
  dossierId: string;
  viewer: 'consultant' | 'client';
}): ReactNode {
  return (
    <QueryBoundary fallback={<OverviewSkeleton />}>
      <Overview dossierId={dossierId} viewer={viewer} />
    </QueryBoundary>
  );
}

function Overview({ dossierId, viewer }: { dossierId: string; viewer: 'consultant' | 'client' }): ReactNode {
  const t = useTranslations('Accompagnement.overview');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.accompagnement.overview.queryOptions({ dossierId }));
  if (!data) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <section aria-labelledby={`${dossierId}-crs`} className={`${card} flex flex-col gap-2`}>
        <h2 id={`${dossierId}-crs`} className="flex items-center gap-2 text-sm font-semibold text-slate">
          <Gauge aria-hidden={true} className="size-4 text-rouge" />
          {t('crs')}
        </h2>
        {data.crsScore === null ? (
          <p className="text-sm text-slate">{t('crsNone')}</p>
        ) : (
          <p className="font-heading text-4xl font-bold text-navy-deep tabular-nums">{data.crsScore}</p>
        )}
      </section>
      <section aria-labelledby={`${dossierId}-ita`} className={`${card} grid gap-3 sm:col-span-2`}>
        <h2 id={`${dossierId}-ita`} className="flex items-center gap-2 text-sm font-semibold text-slate">
          <CalendarClock aria-hidden={true} className="size-4 text-rouge" />
          {t('ita')}
        </h2>
        {data.itaDate ? <Countdown itaDate={data.itaDate} /> : <p className="text-sm text-slate">{t('itaNone')}</p>}
        {viewer === 'consultant' && data.open ? <ItaDateForm dossierId={dossierId} itaDate={data.itaDate} /> : null}
      </section>
    </div>
  );
}

/** The days left of the 60, coloured as they run out, with the last day to submit. */
function Countdown({ itaDate }: { itaDate: string }): ReactNode {
  const t = useTranslations('Accompagnement.overview');
  const format = useFormatter();
  const deadline = itaDeadline(itaDate);
  const left = timeLeft(deadline.closesAt, new Date());
  const day = (value: string) => format.dateTime(utcDate(value), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (left.expired) return <p className="text-sm font-semibold text-rouge">{t('expired', { ita: day(itaDate) })}</p>;
  const urgency = urgencyOf(left.days);
  return (
    <div className="grid grid-cols-1 gap-2">
      <p className={`font-heading text-3xl font-bold ${URGENCY_CLASSES[urgency].text}`}>
        {t('daysLeft', { days: left.days })}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left.share * 100)}
        aria-label={t('daysLeft', { days: left.days })}
        className="h-2 overflow-hidden rounded-full bg-off-white"
      >
        <div className={`h-full rounded-full ${BAR[urgency]}`} style={{ width: `${left.share * 100}%` }} />
      </div>
      <p className="text-sm text-slate">{t('deadline', { ita: day(itaDate), last: day(deadline.lastDay) })}</p>
    </div>
  );
}

/** The consultant sets the ITA's day once it arrives, or takes it back. */
function ItaDateForm({ dossierId, itaDate }: { dossierId: string; itaDate: string | null }): ReactNode {
  const t = useTranslations('Accompagnement');
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(itaDate ?? '');
  const save = useMutation(
    trpc.accompagnement.dashboard.setItaDate.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.overview.queryKey({ dossierId }) });
        toast.add({ title: t('overview.saved'), type: 'success' });
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ dossierId, itaDate: value || null });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-off-white pt-3">
      <label htmlFor={`${id}-ita`} className="grid grid-cols-1 gap-1 text-xs font-semibold text-slate">
        {t('overview.setIta')}
        <input
          id={`${id}-ita`}
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={save.isPending || value === (itaDate ?? '')}
        className="inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
      >
        {t('overview.save')}
      </button>
      {itaDate ? (
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            setValue('');
            save.mutate({ dossierId, itaDate: null });
          }}
          className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-slate hover:text-rouge disabled:opacity-50"
        >
          {t('overview.clear')}
        </button>
      ) : null}
    </form>
  );
}

function OverviewSkeleton(): ReactNode {
  return (
    <div aria-hidden={true} className="grid gap-4 sm:grid-cols-3">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl sm:col-span-2" />
    </div>
  );
}
