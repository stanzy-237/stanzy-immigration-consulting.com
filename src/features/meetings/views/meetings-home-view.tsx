'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { CalendarPlus, Link2, Plus, Video } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { InstantDialog, JoinDialog, PlanDialog } from '@/features/meetings/components/meeting-dialogs';
import { MeetingCard, MeetingCardsSkeleton, MeetingsNav } from '@/features/meetings/components/meeting-parts';
import { useTRPC } from '@/trpc/client';

const tile =
  'flex min-h-40 flex-col justify-between rounded-2xl p-5 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5';

/** « Réunions » home (#94): the time, the next Réunion, four ways in, and today's Réunions. */
export function MeetingsHomeView(): ReactNode {
  const t = useTranslations('Meetings.hub');
  const [dialog, setDialog] = useState<'instant' | 'join' | 'plan' | null>(null);
  const open = (name: typeof dialog) => () => setDialog(name);
  const toggle = (name: Exclude<typeof dialog, null>) => (next: boolean) => setDialog(next ? name : null);

  return (
    <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6">
      <MeetingsNav page="home" title={t('nav.home')} />
      <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-56 rounded-2xl" />}>
        <Clock />
      </QueryBoundary>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={open('instant')} className={`${tile} bg-rouge`}>
          <Tile icon={<Plus aria-hidden={true} className="size-6" />} title={t('home.tiles.instant.title')} body={t('home.tiles.instant.body')} />
        </button>
        <button type="button" onClick={open('join')} className={`${tile} bg-steel-blue`}>
          <Tile icon={<Link2 aria-hidden={true} className="size-6" />} title={t('home.tiles.join.title')} body={t('home.tiles.join.body')} />
        </button>
        <button type="button" onClick={open('plan')} className={`${tile} bg-navy-deep`}>
          <Tile icon={<CalendarPlus aria-hidden={true} className="size-6" />} title={t('home.tiles.plan.title')} body={t('home.tiles.plan.body')} />
        </button>
        <Link href="/reunions/enregistrements" className={`${tile} bg-navy-80`}>
          <Tile icon={<Video aria-hidden={true} className="size-6" />} title={t('home.tiles.recordings.title')} body={t('home.tiles.recordings.body')} />
        </Link>
      </div>

      <section aria-labelledby="meetings-today" className="grid grid-cols-1 gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="meetings-today" className="font-heading text-xl font-bold text-navy-deep">
            {t('home.today')}
          </h2>
          <Link href="/reunions/a-venir" className="text-sm font-semibold text-rouge hover:text-crimson">
            {t('home.seeAll')}
          </Link>
        </div>
        <QueryBoundary fallback={<MeetingCardsSkeleton />}>
          <Today />
        </QueryBoundary>
      </section>

      <InstantDialog open={dialog === 'instant'} onOpenChange={toggle('instant')} />
      <JoinDialog open={dialog === 'join'} onOpenChange={toggle('join')} />
      <PlanDialog open={dialog === 'plan'} onOpenChange={toggle('plan')} />
    </div>
  );
}

function Tile({ icon, title, body }: { icon: ReactNode; title: string; body: string }): ReactNode {
  return (
    <>
      <span className="grid size-12 place-items-center rounded-xl bg-white/20">{icon}</span>
      <span>
        <span className="block font-heading text-xl font-bold">{title}</span>
        <span className="block text-sm text-white/80">{body}</span>
      </span>
    </>
  );
}

/** The time and date in large, and when the next Réunion is. */
function Clock(): ReactNode {
  const t = useTranslations('Meetings.hub.home');
  const format = useFormatter();
  const now = useNow({ updateInterval: 15_000 });
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.dashboard.today.queryOptions());
  return (
    <section className="flex min-h-56 flex-col justify-between gap-6 rounded-2xl bg-navy-deep p-6 text-white shadow-sm md:p-8">
      <p className="w-fit rounded-lg bg-white/10 px-3 py-1.5 text-sm">
        {data.next
          ? t('next', { time: format.dateTime(data.next.startsAt, { hour: '2-digit', minute: '2-digit' }), subject: data.next.subject })
          : t('noNext')}
      </p>
      <div>
        <p className="font-heading text-6xl font-bold tabular-nums md:text-7xl">
          {format.dateTime(now, { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="mt-1 text-lg text-white/80 first-letter:uppercase">
          {format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </section>
  );
}

function Today(): ReactNode {
  const t = useTranslations('Meetings.hub.home');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.dashboard.today.queryOptions());
  if (data.meetings.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('noToday')}
      </p>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {data.meetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} upcoming={true} />
      ))}
    </ul>
  );
}
