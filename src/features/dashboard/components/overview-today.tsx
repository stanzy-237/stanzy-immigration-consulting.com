'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Flag, Inbox, NotebookPen, ReceiptText, Signature, Video, type LucideIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Today = RouterOutputs['overview']['today'];
const DOUALA = 'Africa/Douala';
const card = 'rounded-3xl border border-fog-light bg-white';
const PRESS = 'transition-transform duration-150 ease-standard active:scale-97 motion-reduce:active:scale-100';

/** « Lundi 23 novembre », over the title. */
export function OverviewDate(): ReactNode {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return <p className="font-label text-caption font-bold tracking-wide text-steel-blue uppercase">{format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', timeZone: DOUALA })}</p>;
}

/** The day: four figures, « À traiter », « Aujourd'hui », the live promo code, « Dossiers récents ». `blog` sits beside the Dossiers. */
export function OverviewToday({ blog }: { blog: ReactNode }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({ ...trpc.overview.today.queryOptions(), refetchInterval: 60_000 });
  return (
    <div className="flex flex-col gap-6">
      <Figures data={data} />
      {/* Phone (`Aperçu · Mobile`): the next Réunion right under the figures. */}
      {data.meetings.next ? (
        <div className="lg:hidden">
          <NextMeeting data={data} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ToHandle data={data} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="max-lg:hidden">
            <TodayList data={data} />
          </div>
          {data.promo ? <Promo promo={data.promo} /> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <RecentDossiers data={data} />
        {blog}
      </div>
    </div>
  );
}

export function OverviewTodaySkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-6" aria-hidden={true}>
      <div className="flex gap-3 overflow-hidden lg:grid lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-32 shrink-0 rounded-2xl lg:h-30 lg:w-auto lg:rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="h-96 rounded-3xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
      </div>
    </div>
  );
}

function Figures({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const time = (d: Date | string) => format.dateTime(new Date(d), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const month = format.dateTime(new Date(`${data.collected.month}-15T12:00:00Z`), { month: 'long', timeZone: 'UTC' });
  const figures = [
    { key: 'toHandle', label: t('toHandle'), short: t('toHandle'), value: String(data.toHandle.total), sub: data.toHandle.overdue.count ? t('overdueSub', { count: data.toHandle.overdue.count }) : null, dark: true },
    { key: 'meetings', label: t('meetingsToday'), short: t('meetingsShort'), value: String(data.meetings.today.length), sub: data.meetings.next ? t('nextAt', { time: time(data.meetings.next.startsAt) }) : null },
    { key: 'dossiers', label: t('openDossiers'), short: t('openDossiers'), value: String(data.dossiers.open), sub: t('openedThisMonth', { count: data.dossiers.openedThisMonth }) },
    { key: 'collected', label: t('collected', { month }), short: t('collectedShort'), value: format.number(data.collected.total, { maximumFractionDigits: 0 }), sub: t('collectedSub') },
  ];
  return (
    <ul aria-label={t('figures')} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
      {figures.map((f) => (
        <li
          key={f.key}
          className={cn(
            'flex w-32 shrink-0 snap-start flex-col gap-1.5 rounded-2xl border p-3.5 lg:w-auto lg:gap-2 lg:rounded-3xl lg:p-5',
            f.dark ? 'border-navy-deep bg-navy-deep text-white' : 'border-fog-light bg-white text-navy-deep',
          )}
        >
          <span className={cn('order-2 text-caption leading-4 lg:order-1 lg:text-body-sm', f.dark ? 'text-white/80' : 'text-slate')}>
            <span className="lg:hidden">{f.short}</span>
            <span className="max-lg:hidden">{f.label}</span>
          </span>
          {/* A long amount (« 2 592 500 ») steps down a size so it stays in its card. */}
          <span className={cn('order-1 font-heading text-h3 leading-8 font-extrabold whitespace-nowrap tabular-nums lg:order-2', f.value.length > 6 ? 'lg:text-h3 lg:leading-11' : 'lg:text-h2 lg:leading-11')}>{f.value}</span>
          {f.sub ? <span className={cn('order-3 text-caption max-lg:hidden', f.dark ? 'text-white/80' : 'text-slate')}>{f.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type Row = { key: string; icon: LucideIcon; title: string; sub: string; count: number; href: string; urgent?: boolean; waiting?: boolean };

/** « À traiter »: what waits on him, overdue first in rouge; what waits on the Client in grey. */
function ToHandle({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const { interests, orders, overdue, signatures, reports } = data.toHandle;
  const rows: Row[] = [];
  if (overdue.count && 'id' in overdue)
    rows.push({
      key: 'overdue',
      icon: ReceiptText,
      title: t('rows.overdue'),
      sub: [overdue.number, overdue.name, overdue.dueDate ? t('rows.dueOn', { date: format.dateTime(new Date(overdue.dueDate), { day: 'numeric', month: 'long', timeZone: DOUALA }) }) : null].filter(Boolean).join(' · '),
      count: overdue.count,
      href: overdue.count === 1 ? `/factures/${overdue.id}` : '/factures',
      urgent: true,
    });
  if (interests.count)
    rows.push({
      key: 'interests',
      icon: Inbox,
      title: t('rows.interests'),
      sub: t('rows.interestsSub', { name: interests.names[0] ?? '', others: interests.count - 1 }),
      count: interests.count,
      href: '/demandes',
    });
  if (orders.count) rows.push({ key: 'orders', icon: NotebookPen, title: t('rows.orders'), sub: [orders.service, orders.name].filter(Boolean).join(' · '), count: orders.count, href: '/services-en-cours' });
  if (signatures) rows.push({ key: 'signatures', icon: Signature, title: t('rows.signatures'), sub: t('rows.signaturesSub'), count: signatures, href: '/signatures', waiting: true });
  if (reports) rows.push({ key: 'reports', icon: Flag, title: t('rows.reports'), sub: t('rows.reportsSub'), count: reports, href: '/signalements' });

  return (
    <section aria-labelledby="to-handle" className={cn(card, 'overflow-hidden')}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3 lg:px-6 lg:pt-6">
        <h2 id="to-handle" className="font-heading text-h4 font-bold text-navy-deep">
          {t('toHandle')}
        </h2>
        <span className="text-caption text-slate max-lg:hidden">{t('oldestFirst')}</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-8 text-center">
          <Image src="/stanzy/idle.svg" alt="" width={96} height={110} className="h-24 w-auto" />
          <p className="font-heading text-body font-bold text-navy-deep">{t('allDone')}</p>
          <p className="text-body-sm text-slate">{t('allDoneSub')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-fog-light border-t border-fog-light">
          {rows.map((row) => (
            <li key={row.key}>
              <Link href={row.href} className={cn('flex items-center gap-4 px-5 py-4 lg:px-6', row.urgent ? 'bg-blush hover:bg-blush/70' : 'hover:bg-off-white')}>
                <span aria-hidden={true} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', row.urgent ? 'bg-white text-rouge' : 'bg-ice-blue text-navy-deep')}>
                  <row.icon className="size-4.5" strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('text-body font-bold', row.urgent ? 'text-rouge' : 'text-navy-deep')}>{row.title}</span>
                  <span className="truncate text-body-sm text-slate">{row.sub}</span>
                </span>
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums',
                    row.urgent ? 'bg-rouge text-white' : row.waiting ? 'bg-ice-blue text-slate' : 'bg-navy-deep text-white',
                  )}
                >
                  {row.count}
                </span>
                <ChevronRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute max-lg:hidden" strokeWidth={2.4} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function meetingHref(m: Today['meetings']['today'][number]): string {
  return m.consultationId ? `/consultations/${m.consultationId}` : `/reunions/${m.id}`;
}

/** Desktop « Aujourd'hui »: the day's Réunions, the next one highlighted with « Rejoindre ». */
function TodayList({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const { today, next } = data.meetings;
  return (
    <section aria-labelledby="today" className={cn(card, 'flex flex-col gap-3 p-5 lg:p-6')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today" className="font-heading text-h4 font-bold text-navy-deep">
          {t('today')}
        </h2>
        <span className="text-caption text-slate">{t('doualaTime')}</span>
      </div>
      {today.length === 0 ? (
        <p className="text-body-sm text-slate">{t('noMeetings')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {today.map((m) => {
            const isNext = m.id === next?.id;
            return (
              <li key={m.id} className={cn('flex items-center gap-4 rounded-2xl px-3.5 py-3', isNext && 'bg-ice-blue', m.past && 'opacity-60')}>
                <span className="w-12 shrink-0 font-heading text-body font-bold text-navy-deep tabular-nums">
                  {format.dateTime(new Date(m.startsAt), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA })}
                </span>
                <Link href={meetingHref(m)} className="flex min-w-0 flex-1 flex-col hover:underline">
                  <span className="truncate text-body-sm font-bold text-navy-deep">{m.subject}</span>
                  <span className="text-caption text-slate">
                    {[isNext ? format.relativeTime(new Date(m.startsAt), now) : null, m.consultationId ? (m.paid ? t('paid') : null) : null].filter(Boolean).join(' · ') || ' '}
                  </span>
                </Link>
                {isNext ? <JoinButton meeting={m} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/reunions" className="flex items-center gap-1 self-start text-body-sm font-bold text-rouge">
        {t('allMeetings')}
        <ArrowRight aria-hidden={true} className="size-4" />
      </Link>
    </section>
  );
}

function JoinButton({ meeting, wide }: { meeting: Today['meetings']['today'][number]; wide?: boolean }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const className = cn(
    'flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 font-heading text-body-sm font-bold transition-colors duration-300',
    wide && 'h-13 w-full text-body',
    meeting.joinable ? (wide ? 'bg-white text-navy-deep' : 'bg-navy-deep text-white') : 'pointer-events-none bg-fog-light text-slate',
    PRESS,
  );
  return meeting.joinable ? (
    <Link href={`/reunions/${meeting.id}`} className={className}>
      {wide ? <Video aria-hidden={true} className="size-4.5" strokeWidth={2.2} /> : null}
      {t('join')}
    </Link>
  ) : (
    <span aria-disabled={true} className={className}>
      {t('join')}
    </span>
  );
}

/** Phone « Prochaine réunion »: navy, the next one big with « Rejoindre », the rest of the day under it. */
function NextMeeting({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const { today, next } = data.meetings;
  const time = (d: Date | string) => format.dateTime(new Date(d), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  if (!next) return null;
  const rest = today.filter((m) => m.id !== next.id && !m.past);
  return (
    <section aria-labelledby="next-meeting" className="flex flex-col gap-4 rounded-3xl bg-navy-deep p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <h2 id="next-meeting" className="font-label text-label font-bold tracking-wide text-white/70 uppercase">
          {t('nextMeeting')}
        </h2>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-caption font-semibold">{format.relativeTime(new Date(next.startsAt), now)}</span>
      </div>
      <Link href={meetingHref(next)} className="flex flex-col gap-1">
        <span className="font-heading text-h4 font-extrabold">
          {time(next.startsAt)} · {next.subject}
        </span>
        <span className="text-body-sm text-white/70">{[next.consultationId && next.paid ? t('paidConsultation') : null, t('doualaTime')].filter(Boolean).join(' · ')}</span>
      </Link>
      <JoinButton meeting={next} wide={true} />
      {rest.length ? (
        <ul className="flex flex-col gap-2 border-t border-white/15 pt-3">
          {rest.map((m) => (
            <li key={m.id}>
              <Link href={meetingHref(m)} className="flex gap-3 text-body-sm">
                <span className="w-12 shrink-0 font-bold tabular-nums">{time(m.startsAt)}</span>
                <span className="truncate text-white/85">{m.subject}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Promo({ promo }: { promo: NonNullable<Today['promo']> }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const share = promo.places ? Math.min(100, Math.round((promo.used / promo.places) * 100)) : null;
  return (
    <Link href="/codes-promo" className={cn(card, 'flex flex-col gap-3 p-5 hover:border-fog lg:p-6')}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-label text-label font-bold tracking-wide text-slate uppercase">{t('activePromo')}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-caption font-semibold', promo.exhausted ? 'bg-ice-blue text-slate' : 'bg-leaf-tint text-leaf')}>{promo.exhausted ? t('exhausted') : t('active')}</span>
      </span>
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-heading text-h4 font-extrabold text-navy-deep">{promo.code}</span>
        <span className="font-heading text-body font-bold text-navy-deep tabular-nums">{promo.places ? `${promo.used} / ${promo.places}` : t('usedCount', { count: promo.used })}</span>
      </span>
      {share !== null ? (
        <span aria-hidden={true} className="h-1.5 overflow-hidden rounded-full bg-fog-light">
          <span className="block h-full rounded-full bg-rouge" style={{ width: `${share}%` }} />
        </span>
      ) : null}
      <span className="text-caption text-slate">
        {promo.endsAt
          ? t('endsAt', {
              date: format.dateTime(new Date(promo.endsAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }),
              in: format.relativeTime(new Date(promo.endsAt), now),
            })
          : t('noEnd')}
      </span>
    </Link>
  );
}

function RecentDossiers({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const tStages = useTranslations('Dossiers.stages');
  const tServices = useTranslations('Dossiers.services');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  if (data.dossiers.recent.length === 0) return null;
  return (
    <section aria-labelledby="recent-dossiers" className={cn(card, 'overflow-hidden max-lg:hidden lg:col-span-3')}>
      <div className="flex items-baseline justify-between gap-3 px-6 pt-6 pb-3">
        <h2 id="recent-dossiers" className="font-heading text-h4 font-bold text-navy-deep">
          {t('recentDossiers')}
        </h2>
        <Link href="/dossiers" className="flex items-center gap-1 text-body-sm font-bold text-rouge">
          {t('allDossiers')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </Link>
      </div>
      <ul className="divide-y divide-fog-light border-t border-fog-light">
        {data.dossiers.recent.map((d) => {
          const stageKey = `${d.service}.${d.stage}`;
          return (
            <li key={d.id}>
              <Link href={`/dossiers/${d.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-off-white">
                <span aria-hidden={true} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ice-blue font-label text-caption font-bold text-navy-deep">
                  {initials(d.name)}
                </span>
                <span className="flex w-48 min-w-0 flex-col">
                  <span className="truncate text-body-sm font-bold text-navy-deep">{d.name}</span>
                  <span className="truncate text-caption text-slate">{tServices(d.service)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate text-caption text-ink">
                    {tStages.has(stageKey) ? tStages(stageKey) : d.stage} · {t('stageOf', { position: d.position, total: d.total })}
                  </span>
                  <span aria-hidden={true} className="h-1 overflow-hidden rounded-full bg-fog-light">
                    <span className="block h-full rounded-full bg-navy-deep" style={{ width: `${Math.round((d.position / Math.max(1, d.total)) * 100)}%` }} />
                  </span>
                </span>
                <span className="w-28 shrink-0 text-right text-caption whitespace-nowrap text-slate">{format.relativeTime(new Date(d.updatedAt), now)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
