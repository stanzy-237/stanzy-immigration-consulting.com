'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { FileText, Play, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { MeetingCardsSkeleton, MeetingsNav } from '@/features/meetings/components/meeting-parts';
import { consultantRoomPath, recordingUrl } from '@/features/meetings/lib/meeting-schema';
import { useTRPC } from '@/trpc/client';

/** « Enregistrements » (#94): every recorded Réunion, newest first, to play or open. For the consultant only. */
export function MeetingRecordingsView(): ReactNode {
  const t = useTranslations('Meetings.hub');
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <MeetingsNav page="recordings" title={t('nav.recordings')} />
      <QueryBoundary fallback={<MeetingCardsSkeleton />}>
        <Recordings />
      </QueryBoundary>
    </div>
  );
}

function Recordings(): ReactNode {
  const t = useTranslations('Meetings.hub.recordings');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: recordings } = useSuspenseQuery(trpc.meetings.dashboard.recordings.queryOptions());
  if (recordings.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('empty')}
      </p>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {recordings.map((recording) => {
        const minutes = Math.max(1, Math.round((recording.endedAt.getTime() - recording.startedAt.getTime()) / 60_000));
        return (
          <li key={recording.id} className="flex flex-col gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
            <Video aria-hidden={true} className="size-6 text-navy-deep" />
            <div className="min-w-0">
              <h2 className="truncate font-heading text-lg font-bold text-navy-deep">{recording.meeting.subject}</h2>
              <p className="text-sm text-slate first-letter:uppercase">
                {format.dateTime(recording.startedAt, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {t('duration', { minutes })}
              </p>
              {recording.transcribed ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-leaf">
                  <FileText aria-hidden={true} className="size-3.5" />
                  {t('transcribed')}
                </p>
              ) : null}
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <a
                href={recordingUrl(recording.id)}
                target="_blank"
                rel="noopener"
                aria-label={t('playLabel', { subject: recording.meeting.subject })}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson"
              >
                <Play aria-hidden={true} className="size-4" />
                {t('play')}
              </a>
              <Link
                href={consultantRoomPath(recording.meeting.id)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light"
              >
                {t('open')}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
