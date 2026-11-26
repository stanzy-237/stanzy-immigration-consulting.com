'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { AvailabilityForm } from '@/features/consultation/components/availability-form';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { consultantRoomPath } from '@/features/meetings/lib/meeting-schema';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Tab = 'upcoming' | 'past' | 'failed';
type Listing = RouterOutputs['consultationAdmin']['list'];
type ConsultationRow = Listing['rows'][number];
type FailedRow = Listing['failed'][number];

const DOUALA = 'Africa/Douala';
/** « Rejoindre » opens 15 minutes before the start (meeting-schema's rule). */
const JOIN_BEFORE_MS = 15 * 60_000;

/**
 * Tableau de bord → Consultations (#15, `Tableau de bord · Consultations`):
 * « À venir », « Passées », « Paiements échoués », with the Disponibilités
 * beside them (desktop) or in their sheet (mobile, « Mes disponibilités »).
 */
export function ConsultationsDashboardView(): ReactNode {
  const t = useTranslations('Consultation.admin');
  const [tab, setTab] = useState<Tab>('upcoming');
  const [sheet, setSheet] = useState(false);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-28 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className={cn(LABEL_CLASS, 'text-steel-blue lg:hidden')}>{t('eyebrow')}</p>
          <h1 className="font-heading text-h2 leading-11 font-extrabold tracking-tight text-navy-deep lg:text-h1 lg:leading-14">{t('title')}</h1>
          <p className="hidden text-body leading-6 text-slate lg:block">{t('lead')}</p>
        </div>
        <QueryBoundary fallback={<Skeleton className="h-11 w-96 rounded-full" />}>
          <Tabs tab={tab} onTab={setTab} />
        </QueryBoundary>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <QueryBoundary fallback={<ListSkeleton />}>
            {tab === 'failed' ? <FailedList /> : <ConsultationList tab={tab} />}
          </QueryBoundary>
        </div>
        <section aria-labelledby="availability" className="hidden w-100 shrink-0 rounded-3xl border border-fog-light bg-white p-6 lg:block">
          <AvailabilityHeading />
          <QueryBoundary fallback={<Skeleton className="h-130 rounded-2xl" />}>
            <Availability />
          </QueryBoundary>
        </section>
      </div>

      {/* Mobile: « Mes disponibilités » in the bottom bar opens its sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-fog-light bg-white px-5 pt-4 pb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className={cn('flex h-14 items-center justify-center gap-2.5 rounded-full bg-navy-deep font-heading text-body font-bold text-white', PRESS)}
        >
          <CalendarDays aria-hidden={true} className="size-5" strokeWidth={2.2} />
          {t('availability.mine')}
        </button>
        <p className="text-center text-caption leading-4 text-slate">{t('availability.mineHint')}</p>
      </div>
      <Drawer open={sheet} onOpenChange={setSheet} showSwipeHandle={true}>
        <DrawerContent className="max-h-dvh overflow-y-auto rounded-t-3xl px-5 pt-2 pb-8 lg:hidden">
          <div className="flex items-center justify-between py-4">
            <DrawerTitle className="font-heading text-h4 font-bold text-navy-deep">{t('availability.title')}</DrawerTitle>
            <DrawerClose aria-label={t('close')} className="flex size-9 items-center justify-center rounded-full bg-off-white">
              <X aria-hidden={true} className="size-4 text-ink" strokeWidth={2.5} />
            </DrawerClose>
          </div>
          <QueryBoundary fallback={<Skeleton className="h-130 rounded-2xl" />}>
            <Availability onSaved={() => setSheet(false)} />
          </QueryBoundary>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Tabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }): ReactNode {
  const t = useTranslations('Consultation.admin.tabs');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.list.queryOptions({ tab: 'upcoming' }));
  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: t('upcoming', { count: data.counts.upcoming }) },
    { key: 'past', label: t('past') },
    { key: 'failed', label: t('failed', { count: data.counts.failed }) },
  ];
  return (
    <div role="tablist" aria-label={t('label')} className="flex gap-1 rounded-full bg-ice-blue p-1 lg:gap-2 lg:bg-transparent lg:p-0">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onTab(key)}
          className={cn(
            'h-11 flex-1 rounded-full px-4 text-body-sm font-bold whitespace-nowrap lg:flex-none lg:border-2',
            tab === key ? 'bg-white text-ink shadow-sm lg:border-navy-deep lg:bg-navy-deep lg:text-white' : 'text-slate lg:border-fog-light lg:bg-white lg:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AvailabilityHeading(): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  return (
    <div className="flex flex-col gap-1 pb-5">
      <h2 id="availability" className="font-heading text-h4 font-bold text-navy-deep">
        {t('title')}
      </h2>
      <p className="text-body-sm leading-5 text-slate">{t('lead')}</p>
    </div>
  );
}

function Availability({ onSaved }: { onSaved?: () => void }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.settings.queryOptions());
  return <AvailabilityForm settings={data} onSaved={onSaved} />;
}

/** A status pill: small, never wraps. */
const PILL = 'inline-block rounded-full px-2 py-0.5 font-label tracking-wide whitespace-nowrap';
/** A Client's name in a row: one line, cut with « … », the full name on hover. */
const NAME = 'max-w-full truncate text-body-sm leading-5 font-bold text-ink';

/** « Payée · MTN », « Payée · carte », « En attente », « Gardé N min ». */
function PaymentBadge({ row, now }: { row: ConsultationRow; now: Date }): ReactNode {
  const t = useTranslations('Consultation.admin.row');
  if (row.status === 'PAID') {
    return (
      <span className={cn(PILL, 'bg-leaf-tint text-leaf')}>
        {t('paid', { network: row.card ? t('card') : shortNetwork(row.network) })}
      </span>
    );
  }
  const left = row.heldUntil ? Math.max(0, Math.ceil((new Date(row.heldUntil).getTime() - now.getTime()) / 60_000)) : 0;
  return <span className={cn(PILL, 'bg-honey-tint text-honey')}>{t('held', { minutes: left })}</span>;
}

/** « MTN Mobile Money » → « MTN »: the badge keeps the operator. */
const shortNetwork = (name: string | null) => (name ?? '').replace(/\s*(Mobile Money|MoMo|Money)\b.*$/i, '').trim() || name || '';

function ConsultationList({ tab }: { tab: 'upcoming' | 'past' }): ReactNode {
  const t = useTranslations('Consultation.admin');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.list.queryOptions({ tab }));
  if (data.rows.length === 0) {
    return <p className="rounded-3xl border border-fog-light bg-white p-8 text-center text-body-sm leading-5 text-slate">{t(tab === 'upcoming' ? 'emptyUpcoming' : 'emptyPast')}</p>;
  }

  const day = (d: Date) => format.dateTime(d, { weekday: 'short', day: 'numeric', month: 'short', timeZone: DOUALA });
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const who = (row: ConsultationRow) =>
    row.status === 'HELD'
      ? t('row.holding')
      : [t(`row.status.${row.client.status as 'USER' | 'LEAD' | 'CLIENT'}`), row.crsScore !== null ? t('row.crs', { score: row.crsScore }) : null].filter(Boolean).join(' · ');
  const canJoin = (row: ConsultationRow) => row.status === 'PAID' && row.meetingId && now.getTime() >= new Date(row.startsAt).getTime() - JOIN_BEFORE_MS;

  // Mobile: grouped by day.
  const groups = new Map<string, ConsultationRow[]>();
  for (const row of data.rows) {
    const key = format.dateTime(new Date(row.startsAt), { weekday: 'long', day: 'numeric', month: 'long', timeZone: DOUALA });
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <>
      <section aria-label={t('tabs.label')} className="hidden overflow-hidden rounded-3xl border border-fog-light bg-white lg:block">
        <div className={cn(LABEL_CLASS, 'grid grid-cols-12 gap-4 border-b border-fog-light px-5 py-4 text-slate')}>
          <span className="col-span-3">{t('columns.when')}</span>
          <span className="col-span-4">{t('columns.client')}</span>
          <span className="col-span-3">{t('columns.payment')}</span>
          <span className="col-span-2 text-right">{t('columns.action')}</span>
        </div>
        <ul className="divide-y divide-fog-light">
          {data.rows.map((row) => {
            const starts = new Date(row.startsAt);
            const ends = new Date(starts.getTime() + row.durationMinutes * 60_000);
            return (
              <li key={row.id} className="relative grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-off-white">
                <div className="col-span-3 flex flex-col">
                  <Link href={`/consultations/${row.id}`} className="text-body-sm leading-5 font-bold text-ink after:absolute after:inset-0 first-letter:uppercase">
                    {day(starts)}
                  </Link>
                  <span className="text-caption text-slate">
                    {time(starts)} – {time(ends)}
                  </span>
                </div>
                <div className="col-span-4 flex min-w-0 flex-col">
                  <span title={row.client.name} className={NAME}>{row.client.name}</span>
                  <span className="text-caption text-slate">{who(row)}</span>
                </div>
                <div className="col-span-3">
                  <PaymentBadge row={row} now={now} />
                </div>
                <div className="relative z-10 col-span-2 text-right">
                  {canJoin(row) ? (
                    <Link href={consultantRoomPath(row.meetingId!)} className="rounded-full bg-navy-deep px-4 py-2 text-caption font-bold text-white">
                      {t('join')}
                    </Link>
                  ) : row.status === 'PAID' && tab === 'upcoming' ? (
                    <Link href={`/consultations/${row.id}`} className="text-caption font-bold text-ink underline underline-offset-2">
                      {t('move')}
                    </Link>
                  ) : (
                    <span className="text-slate-mute">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-5 lg:hidden">
        {[...groups].map(([label, rows]) => (
          <section key={label} aria-label={label} className="flex flex-col gap-2.5">
            <h2 className={cn(LABEL_CLASS, 'text-slate')}>{label}</h2>
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/consultations/${row.id}`}
                className={cn(
                  'flex items-center gap-4 rounded-2xl bg-white p-4',
                  row.status === 'HELD' ? 'border border-dashed border-fog' : 'border border-fog-light',
                )}
              >
                <span className="flex w-14 flex-col">
                  <span className="font-heading text-h4 font-extrabold text-ink">{time(new Date(row.startsAt))}</span>
                  <span className="text-caption text-slate">{row.durationMinutes} min</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span title={row.client.name} className={NAME}>{row.client.name}</span>
                  <PaymentBadge row={row} now={now} />
                </span>
                <ChevronRight aria-hidden={true} className="size-4 text-slate" />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

/** « Paiements échoués »: each failed try, who, the slot they wanted, and what happened next. */
function FailedList(): ReactNode {
  const t = useTranslations('Consultation.admin.failed');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.list.queryOptions({ tab: 'failed' }));
  if (data.failed.length === 0) return <p className="rounded-3xl border border-fog-light bg-white p-8 text-center text-body-sm leading-5 text-slate">{t('empty')}</p>;

  const when = (d: Date) => format.dateTime(d, { weekday: 'short', day: 'numeric', month: 'short', timeZone: DOUALA });
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const outcome = (row: FailedRow) => (row.refusedAtOnce ? t('notSent') : t('refused'));

  return (
    <section aria-label={t('label')} className="overflow-hidden rounded-3xl border border-fog-light bg-white">
      <div className={cn(LABEL_CLASS, 'hidden grid-cols-12 gap-4 border-b border-fog-light px-5 py-4 text-slate lg:grid')}>
        <span className="col-span-3">{t('columns.attempt')}</span>
        <span className="col-span-4">{t('columns.client')}</span>
        <span className="col-span-3">{t('columns.payment')}</span>
        <span className="col-span-2 text-right">{t('columns.next')}</span>
      </div>
      <ul className="divide-y divide-fog-light">
        {data.failed.map((row) => (
          <li key={row.id} className="grid grid-cols-2 items-center gap-3 px-5 py-4 lg:grid-cols-12 lg:gap-4">
            <div className="flex flex-col lg:col-span-3">
              <span className="text-body-sm leading-5 font-bold text-ink first-letter:uppercase">{when(new Date(row.at))}</span>
              <span className="text-caption text-slate">
                {time(new Date(row.at))}
                {row.released ? ` · ${t('released')}` : ''}
              </span>
            </div>
            <div className="flex min-w-0 flex-col lg:col-span-4">
              <span title={row.client.name} className={NAME}>{row.client.name}</span>
              <span className="text-caption text-slate">
                {row.paidLater && row.minutesToPaid !== null
                  ? t('retried', { minutes: row.minutesToPaid })
                  : t('wanted', { when: `${when(new Date(row.wanted))} · ${time(new Date(row.wanted))}` })}
              </span>
            </div>
            <div className="lg:col-span-3">
              <span className={cn(PILL, row.refusedAtOnce ? 'bg-honey-tint text-honey' : 'bg-blush text-rouge')}>
                {outcome(row)}
                {row.network ? ` · ${shortNetwork(row.network)}` : ''}
              </span>
            </div>
            <div className="text-right lg:col-span-2">
              {row.paidLater ? (
                <span className={cn(PILL, 'bg-leaf-tint text-leaf')}>{t('paidLater')}</span>
              ) : (
                <Link href={`/comptes/${row.client.id}`} className="text-caption font-bold text-ink underline underline-offset-2">
                  {t('account')}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-fog-light bg-off-white px-5 py-4 text-caption leading-5 text-slate">{t('note')}</p>
    </section>
  );
}

function ListSkeleton(): ReactNode {
  const t = useTranslations('Consultation.admin');
  return (
    <div role="status" className="flex animate-skeleton-in flex-col gap-3">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-80 rounded-3xl" />
    </div>
  );
}
