'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, Clock, List } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { AvailabilityBar } from '@/features/consultation/components/availability-bar';
import { AvailabilityForm } from '@/features/consultation/components/availability-form';
import { ConsultationsCalendar } from '@/features/consultation/components/consultations-calendar';
import { TOPIC_KEYS, type TopicKey } from '@/features/consultation/lib/booking-fields';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { mondayOf } from '@/features/consultation/lib/week-calendar';
import { consultantRoomPath } from '@/features/meetings/lib/meeting-schema';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Tab = 'upcoming' | 'past' | 'failed';
type View = 'list' | 'calendar' | 'availability';

/** « Liste / Calendrier / Disponibilités »: the consultant's last choice, kept on this device. */
const VIEW_KEY = 'stanzy.consultations.view';
const viewListeners = new Set<() => void>();
const subscribeView = (listener: () => void) => {
  viewListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};
const VIEWS: View[] = ['list', 'calendar', 'availability'];
const readView = (): View => VIEWS.find((v) => v === window.localStorage.getItem(VIEW_KEY)) ?? 'list';
function useView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribeView, readView, () => 'list' as const);
  const setView = (next: View) => {
    window.localStorage.setItem(VIEW_KEY, next);
    for (const listener of viewListeners) listener();
  };
  return [view, setView];
}
type Listing = RouterOutputs['consultationAdmin']['list'];
type ConsultationRow = Listing['rows'][number];
type FailedRow = Listing['failed'][number];

const DOUALA = 'Africa/Douala';
/** « Rejoindre » opens 15 minutes before the start (meeting-schema's rule). */
const JOIN_BEFORE_MS = 15 * 60_000;

/**
 * Tableau de bord → Consultations (#15, `Consultations · C`): three views.
 * « Liste »: « À venir », « Passées », « Paiements échoués », full width.
 * « Calendrier »: the Disponibilités in one bar (« Modifier » opens the side
 * panel) above the week. « Disponibilités »: every setting, with the week's
 * hours on timelines.
 */
export function ConsultationsDashboardView(): ReactNode {
  const t = useTranslations('Consultation.admin');
  const [tab, setTab] = useState<Tab>('upcoming');
  const [view, setView] = useView();
  const now = useNow();
  const [week, setWeek] = useState(() => mondayOf(doualaDay(now)));
  // Another week keeps this one on screen until it has loaded, instead of a skeleton.
  const [, startTransition] = useTransition();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className={cn(LABEL_CLASS, 'text-steel-blue lg:hidden')}>{t('eyebrow')}</p>
          <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep sm:text-h2 sm:leading-11 lg:text-h1 lg:leading-14">{t('title')}</h1>
          <p className="hidden text-body leading-6 text-slate lg:block">{t('lead')}</p>
        </div>
        <ViewSwitch view={view} onView={setView} />
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-4">
          <QueryBoundary fallback={<Skeleton className="h-11 w-96 rounded-full" />}>
            <Tabs tab={tab} onTab={setTab} />
          </QueryBoundary>
          <QueryBoundary fallback={<ListSkeleton />}>{tab === 'failed' ? <FailedList /> : <ConsultationList tab={tab} />}</QueryBoundary>
        </div>
      ) : null}

      {view === 'calendar' ? (
        <div className="flex flex-col gap-4">
          <QueryBoundary fallback={<Skeleton className="h-16 rounded-2xl" />}>
            <AvailabilityBar />
          </QueryBoundary>
          <QueryBoundary fallback={<Skeleton className="h-150 rounded-3xl" />}>
            <ConsultationsCalendar week={week} onWeek={(next) => startTransition(() => setWeek(next))} />
          </QueryBoundary>
        </div>
      ) : null}

      {view === 'availability' ? (
        <QueryBoundary fallback={<Skeleton className="h-130 rounded-3xl" />}>
          <AvailabilityPage />
        </QueryBoundary>
      ) : null}
    </div>
  );
}

/** « Liste / Calendrier / Disponibilités ». */
function ViewSwitch({ view, onView }: { view: View; onView: (view: View) => void }): ReactNode {
  const t = useTranslations('Consultation.admin.calendar.view');
  const options = [
    { key: 'list' as const, label: t('list'), Icon: List },
    { key: 'calendar' as const, label: t('calendar'), Icon: CalendarDays },
    { key: 'availability' as const, label: t('availability'), Icon: Clock },
  ];
  return (
    <div role="radiogroup" aria-label={t('label')} className="flex gap-1 rounded-full bg-ice-blue p-1">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={view === key}
          onClick={() => onView(key)}
          className={cn(
            'flex h-9 flex-1 items-center justify-center gap-2 rounded-full px-3 text-body-sm font-semibold whitespace-nowrap sm:px-4 lg:flex-none',
            view === key ? 'bg-white text-navy-deep shadow-sm' : 'text-slate',
            PRESS,
          )}
        >
          <Icon aria-hidden={true} className="hidden size-4 sm:block" strokeWidth={2.2} />
          {label}
        </button>
      ))}
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

/** The « Disponibilités » view: every setting at once. */
function AvailabilityPage(): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.settings.queryOptions());
  return <AvailabilityForm settings={data} layout="page" />;
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
  const tTopics = useTranslations('Consultation.reservation.prepare.topic');
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
  const prepared = (row: ConsultationRow) =>
    row.topics
      .filter((topic): topic is TopicKey => (TOPIC_KEYS as readonly string[]).includes(topic))
      .map((topic) => tTopics(topic))
      .join(' · ');
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
          <span className="col-span-2">{t('columns.when')}</span>
          <span className="col-span-3">{t('columns.client')}</span>
          <span className="col-span-2">{t('columns.payment')}</span>
          <span className="col-span-3">{t('columns.prepared')}</span>
          <span className="col-span-2 text-right">{t('columns.action')}</span>
        </div>
        <ul className="divide-y divide-fog-light">
          {data.rows.map((row) => {
            const starts = new Date(row.startsAt);
            const ends = new Date(starts.getTime() + row.durationMinutes * 60_000);
            return (
              <li key={row.id} className="relative grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-off-white">
                <div className="col-span-2 flex flex-col">
                  <Link href={`/consultations/${row.id}`} className="text-body-sm leading-5 font-bold text-ink after:absolute after:inset-0 first-letter:uppercase">
                    {day(starts)}
                  </Link>
                  <span className="text-caption text-slate">
                    {time(starts)} – {time(ends)}
                  </span>
                </div>
                <div className="col-span-3 flex min-w-0 flex-col">
                  <span title={row.client.name} className={NAME}>{row.client.name}</span>
                  <span className="text-caption text-slate">{who(row)}</span>
                </div>
                <div className="col-span-2">
                  <PaymentBadge row={row} now={now} />
                </div>
                <div className="col-span-3 min-w-0">
                  {prepared(row) ? (
                    <span title={prepared(row)} className="block truncate text-caption text-slate">
                      {prepared(row)}
                    </span>
                  ) : (
                    <span className="text-caption text-slate-mute">—</span>
                  )}
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
