'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Flag, Inbox, NotebookPen, ReceiptText, Signature, TicketPercent, Video, type LucideIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { CollectedIllustration, CountdownIllustration, DossierIllustration, ToHandleIllustration } from '@/features/dashboard/components/overview-illustrations';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Today = RouterOutputs['overview']['today'];
const DOUALA = 'Africa/Douala';
const card = 'rounded-3xl border border-fog-light bg-white';
const PRESS = 'transition-transform duration-150 ease-standard active:scale-97 motion-reduce:active:scale-100';

/** « Lundi 23 novembre », over the title. */
export function OverviewDate({ plain = false }: { plain?: boolean }): ReactNode {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const text = format.dateTime(now, plain ? { weekday: 'long', day: 'numeric', month: 'short', timeZone: DOUALA } : { weekday: 'long', day: 'numeric', month: 'long', timeZone: DOUALA });
  return plain ? text : <p className="font-label text-caption font-bold tracking-wide text-steel-blue uppercase">{text}</p>;
}

/** The day: four figures, « À traiter », « Aujourd'hui », the live promo code, « Dossiers récents ». `blog` sits beside the Dossiers. */
export function OverviewToday({ blog }: { blog: ReactNode }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({ ...trpc.overview.today.queryOptions(), refetchInterval: 60_000 });
  return (
    <div className="flex flex-col gap-6">
      {/* Below `lg` (`Mobile v2 · 1 Aperçu`): the next Réunion first. */}
      {data.meetings.next ? (
        <div className="lg:hidden">
          <NextMeeting data={data} />
        </div>
      ) : null}
      <Figures data={data} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ToHandle data={data} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-1 flex-col max-lg:hidden">
            <TodayList data={data} />
          </div>
          {/* Phones: the promo code is in « Plus ». */}
          <div className="max-md:hidden">{data.promo ? <Promo promo={data.promo} /> : <NoPromo />}</div>
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

type Figure = {
  key: string;
  label: string;
  short: string;
  value: string;
  /** The band's pill (« 1 en retard », « Prochaine 10:00 »…), if there is something to say. */
  pill: { text: string; tone: 'rouge' | 'navy' | 'leaf' } | null;
  band: string;
  art: ReactNode;
  /** Below `lg` (`Mobile v2 · 1 Aperçu`): a small spot instead of the band. */
  spot: ReactNode;
  /** Below `lg`, where the tile is narrow (« 2,59 M »). */
  compact?: string;
  dark?: boolean;
};

/**
 * The four figures (`Aperçu · Chiffres illustrés`, variant C « Bandeau
 * illustré »): each card opens on a tinted band with its scene and a pill,
 * the number under it; Stanzy leads « À traiter ». Phones keep the compact
 * tiles that scroll (`Aperçu · Mobile`).
 */
function Figures({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const time = (d: Date | string) => format.dateTime(new Date(d), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const month = format.dateTime(new Date(`${data.collected.month}-15T12:00:00Z`), { month: 'long', timeZone: 'UTC' });
  const overdue = data.toHandle.overdue.count;
  const art = 'absolute top-1 left-3 size-28';
  const spot = 'size-11';
  const figures: Figure[] = [
    {
      key: 'toHandle',
      label: t('toHandle'),
      short: t('toHandle'),
      value: String(data.toHandle.total),
      pill: overdue ? { text: t('overduePill', { count: overdue }), tone: 'rouge' } : null,
      band: 'bg-navy-80',
      art: <Image src="/stanzy/pointr.svg" alt="" width={96} height={168} className="absolute top-2.5 left-3.5 h-42 w-24" />,
      spot: <ToHandleIllustration className={spot} />,
      dark: true,
    },
    {
      key: 'meetings',
      label: t('meetingsToday'),
      short: t('meetingsShort'),
      value: String(data.meetings.today.length),
      pill: data.meetings.next ? { text: t('nextPill', { time: time(data.meetings.next.startsAt) }), tone: 'navy' } : null,
      band: 'bg-ice-blue',
      art: <CountdownIllustration className={art} />,
      spot: <CountdownIllustration className={spot} />,
    },
    {
      key: 'dossiers',
      label: t('openDossiers'),
      short: t('openDossiers'),
      value: String(data.dossiers.open),
      pill: data.dossiers.openedThisMonth ? { text: t('createdPill', { count: data.dossiers.openedThisMonth }), tone: 'navy' } : null,
      band: 'bg-ice-blue',
      art: <DossierIllustration className={art} />,
      spot: <DossierIllustration className={spot} />,
    },
    {
      key: 'collected',
      label: t('collectedLabel'),
      short: t('collectedShort'),
      value: format.number(data.collected.total, { maximumFractionDigits: 0 }),
      compact: format.number(data.collected.total, { notation: 'compact', maximumFractionDigits: 2 }),
      pill: { text: month, tone: 'leaf' },
      band: 'bg-leaf-tint',
      art: <CollectedIllustration className={art} />,
      spot: <CollectedIllustration className={spot} />,
    },
  ];
  return (
    <ul aria-label={t('figures')} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-5">
      {figures.map((f) => (
        <li
          key={f.key}
          className={cn(
            // `relative`: keeps the sr-only pill text inside the strip, not off the page's edge.
            'relative flex flex-col overflow-hidden rounded-2xl border lg:rounded-3xl',
            f.dark ? 'border-navy-deep bg-navy-deep text-white' : 'border-fog-light bg-white text-navy-deep',
          )}
        >
          <div aria-hidden={true} className={cn('relative h-24 overflow-hidden max-lg:hidden', f.band)}>
            {f.art}
            {f.pill ? (
              <span
                className={cn(
                  'absolute top-4 right-4 rounded-full px-2.5 py-1 text-caption font-bold first-letter:uppercase',
                  f.pill.tone === 'rouge' ? 'bg-rouge text-white' : f.pill.tone === 'leaf' ? 'bg-white text-leaf' : 'bg-white text-navy-deep',
                )}
              >
                {f.pill.text}
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3.5 lg:px-5 lg:pt-4 lg:pb-5">
            <span aria-hidden={true} className="mb-1.5 lg:hidden">
              {f.spot}
            </span>
            {/* A long amount (« 2 592 500 ») steps down a size so it stays in its card. */}
            <span className={cn('font-heading text-h4 leading-8 font-extrabold whitespace-nowrap tabular-nums sm:text-h3 lg:leading-11', f.value.length > 6 ? 'lg:text-h3' : 'lg:text-h2')}>
              <span className={cn(f.compact && 'lg:hidden', !f.compact && 'hidden')}>{f.compact}</span>
              <span className={cn(f.compact && 'max-lg:hidden')}>{f.value}</span>
            </span>
            <span className={cn('text-caption leading-4 lg:text-body-sm', f.dark ? 'text-white/80' : 'text-slate')}>
              <span className="lg:hidden">
                {f.short}
                {f.pill && f.key === 'toHandle' ? ` · ${f.pill.text}` : ''}
              </span>
              <span className="max-lg:hidden">{f.label}</span>
            </span>
            {/* What the pill says, for screen readers (the band is decorative). */}
            {f.pill ? <span className="sr-only">{f.pill.text}</span> : null}
          </div>
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
  const none = t('rows.none');
  // The five always show, as on the board: what has nothing waiting stays grey (« Rien en attente »).
  const overdueRow: Row = {
    key: 'overdue',
    icon: ReceiptText,
    title: t('rows.overdue'),
    sub:
      overdue.count && 'id' in overdue
        ? [overdue.number, overdue.name, overdue.dueDate ? t('rows.dueOn', { date: format.dateTime(new Date(overdue.dueDate), { day: 'numeric', month: 'long', timeZone: DOUALA }) }) : null].filter(Boolean).join(' · ')
        : none,
    count: overdue.count,
    href: overdue.count === 1 && 'id' in overdue ? `/factures/${overdue.id}` : '/factures',
    urgent: overdue.count > 0,
  };
  const rest: Row[] = [
    { key: 'interests', icon: Inbox, title: t('rows.interests'), sub: interests.count ? t('rows.interestsSub', { name: interests.names[0] ?? '', others: interests.count - 1 }) : none, count: interests.count, href: '/demandes' },
    { key: 'orders', icon: NotebookPen, title: t('rows.orders'), sub: orders.count ? [orders.service, orders.name].filter(Boolean).join(' · ') : none, count: orders.count, href: '/services-en-cours' },
    { key: 'signatures', icon: Signature, title: t('rows.signatures'), sub: signatures ? t('rows.signaturesSub') : none, count: signatures, href: '/signatures', waiting: true },
    { key: 'reports', icon: Flag, title: t('rows.reports'), sub: reports ? t('rows.reportsSub') : none, count: reports, href: '/signalements' },
  ];
  // Overdue Factures lead when there are some; otherwise they take their place among the rest.
  const rows = overdue.count ? [overdueRow, ...rest] : [...rest.slice(0, 2), overdueRow, ...rest.slice(2)];
  const allDone = rows.every((row) => row.count === 0);

  return (
    <section aria-labelledby="to-handle" className={cn(card, 'flex h-full flex-col overflow-hidden')}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3 lg:px-6 lg:pt-6">
        <h2 id="to-handle" className="font-heading text-h4 font-bold text-navy-deep">
          {t('toHandle')}
        </h2>
        <span className="text-caption text-slate max-lg:hidden">{t('oldestFirst')}</span>
        {!allDone && rows.some((row) => row.count === 0) ? <span className="text-caption text-slate lg:hidden">{t('restUpToDate')}</span> : null}
      </div>
      {allDone ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-2 pb-8 text-center">
          <Image src="/stanzy/idle.svg" alt="" width={96} height={110} className="h-24 w-auto" />
          <p className="font-heading text-body font-bold text-navy-deep">{t('allDone')}</p>
          <p className="text-body-sm text-slate">{t('allDoneSub')}</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-fog-light border-t border-fog-light">
          {rows.map((row) => (
            // Below `lg` only what waits: the empty lines stay on wider screens.
            <li key={row.key} className={cn('flex flex-1', row.count === 0 && 'max-lg:hidden')}>
              <Link href={row.href} className={cn('flex min-w-0 flex-1 items-center gap-4 px-5 py-4 lg:px-6', row.urgent ? 'bg-blush hover:bg-blush/70' : 'hover:bg-off-white')}>
                <span
                  aria-hidden={true}
                  className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', row.urgent ? 'bg-white text-rouge' : row.count ? 'bg-ice-blue text-navy-deep' : 'bg-off-white text-slate-mute')}
                >
                  <row.icon className="size-4.5" strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('text-body font-bold', row.urgent ? 'text-rouge' : row.count ? 'text-navy-deep' : 'text-slate')}>{row.title}</span>
                  <span className="truncate text-body-sm text-slate">{row.sub}</span>
                </span>
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums',
                    row.urgent ? 'bg-rouge text-white' : !row.count ? 'bg-off-white text-slate-mute' : row.waiting ? 'bg-ice-blue text-slate' : 'bg-navy-deep text-white',
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
    <section aria-labelledby="today" className={cn(card, 'flex flex-1 flex-col gap-3 p-5 lg:p-6')}>
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
      <Link href="/reunions" className="mt-auto flex items-center gap-1 self-start pt-2 text-body-sm font-bold text-rouge">
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

/**
 * Below `lg` (`Mobile v2 · 1 Aperçu`): the next Réunion in one line, its time
 * in a tile, who, and « Rejoindre » once the room opens (« Ouvre 13:45 » before).
 */
function NextMeeting({ data }: { data: Today }): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const { next } = data.meetings;
  if (!next) return null;
  const starts = new Date(next.startsAt);
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const who = next.subject.replace(/^Consultation · /, '');
  return (
    <section aria-labelledby="next-meeting" className="flex items-center gap-3.5 rounded-2xl bg-navy-deep p-3.5 text-white">
      <span className="flex min-w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 px-2.5 py-2">
        <span className="font-heading text-body font-extrabold whitespace-nowrap tabular-nums">{time(starts)}</span>
        <span className="font-label text-label font-bold whitespace-nowrap text-rose">{format.relativeTime(starts, { now, style: 'short' })}</span>
      </span>
      <Link href={meetingHref(next)} className="flex min-w-0 flex-1 flex-col">
        <h2 id="next-meeting" className="font-label text-label font-bold tracking-wide text-white/70 uppercase">
          {t('nextShort')}
        </h2>
        <span className="truncate text-body font-bold">{who}</span>
        <span className="text-caption text-white/70">{next.consultationId ? (next.paid ? t('paidConsultation') : t('consultation')) : t('meeting')}</span>
      </Link>
      {next.joinable ? (
        <Link href={`/reunions/${next.id}`} className={cn('flex h-10 shrink-0 animate-ring-once items-center rounded-full bg-white px-4 font-heading text-body-sm font-bold text-navy-deep motion-reduce:animate-none', PRESS)}>
          {t('join')}
        </Link>
      ) : (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-2 font-heading text-caption font-bold whitespace-nowrap text-white/70">
          {t('opensAt', { time: time(new Date(starts.getTime() - 15 * 60_000)) })}
        </span>
      )}
    </section>
  );
}

/** No live code: the place says so and offers one (Codes promo). */
function NoPromo(): ReactNode {
  const t = useTranslations('Dashboard.overview.today');
  return (
    <Link href="/codes-promo" className={cn(card, 'flex items-center gap-4 border-dashed p-5 hover:border-fog lg:p-6')}>
      <span aria-hidden={true} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blush text-rouge">
        <TicketPercent className="size-4.5" strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-label text-label font-bold tracking-wide text-slate uppercase">{t('activePromo')}</span>
        <span className="text-body-sm text-ink">{t('noPromo')}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-body-sm font-bold text-rouge">
        {t('createPromo')}
        <ArrowRight aria-hidden={true} className="size-4" />
      </span>
    </Link>
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
