'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { MeetingCard, MeetingCardsSkeleton, MeetingsNav } from '@/features/meetings/components/meeting-parts';
import { useTRPC } from '@/trpc/client';

type List = 'upcoming' | 'past';

/** « À venir » or « Passées » (#94): every Réunion as a card, with or without a Dossier. */
export function MeetingsListView({ list }: { list: List }): ReactNode {
  const t = useTranslations('Meetings.hub');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6">
      <MeetingsNav page={list} title={t(`list.${list}`)} />
      <QueryBoundary fallback={<MeetingCardsSkeleton />}>
        <Cards list={list} />
      </QueryBoundary>
    </div>
  );
}

function Cards({ list }: { list: List }): ReactNode {
  const t = useTranslations('Meetings.hub.list');
  const trpc = useTRPC();
  const { data: meetings } = useSuspenseQuery(trpc.meetings.dashboard.list.queryOptions({ list }));
  if (meetings.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {list === 'upcoming' ? t('emptyUpcoming') : t('emptyPast')}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {meetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} upcoming={list === 'upcoming'} />
      ))}
    </ul>
  );
}
