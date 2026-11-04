'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Circle, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
// The consultant's room is on admin.<site>'s short paths (see dashboard-host).
import NextLink from 'next/link';
import { useCallback, useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import type { RoomAccess } from '@/features/meetings/components/meeting-call';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

// Stream's call runs in the browser only (camera, micro, WebRTC).
const MeetingCall = dynamic(() => import('@/features/meetings/components/meeting-call').then((m) => m.MeetingCall), {
  ssr: false,
});

type Viewer = 'consultant' | 'client';

/**
 * A Réunion's room (#94): when it is recorded, « Cette réunion est
 * enregistrée » to accept first (once, saved with the time); then the call.
 * Before the room opens, after it closes, or once cancelled, it says so.
 */
export function MeetingRoomView({
  dossierId,
  meetingId,
  viewer,
}: {
  dossierId: string;
  meetingId: string;
  viewer: Viewer;
}): ReactNode {
  const t = useTranslations('Meetings.room');
  const back = viewer === 'consultant' ? `/dossiers/${dossierId}#reunions` : `/mon-espace/dossiers/${dossierId}#reunions`;
  const backClass = 'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep';
  const content = (
    <div className="mx-auto grid max-w-5xl gap-4">
      {viewer === 'consultant' ? (
        <NextLink href={back} className={backClass}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </NextLink>
      ) : (
        <Link href={back} className={backClass}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </Link>
      )}
      <QueryBoundary fallback={<RoomSkeleton />}>
        <Room meetingId={meetingId} />
      </QueryBoundary>
    </div>
  );
  if (viewer === 'consultant') return content;
  // In « Mon espace », the site's own frame.
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">{content}</main>
      <SiteFooter />
    </>
  );
}

function Room({ meetingId }: { meetingId: string }): ReactNode {
  const t = useTranslations('Meetings.room');
  const panel = useTranslations('Meetings.panel');
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const failed = useMeetingErrors();
  // Waiting for the room to open: asked again every 30 seconds.
  const { data: meeting } = useSuspenseQuery({
    ...trpc.meetings.room.queryOptions({ id: meetingId }),
    refetchInterval: (query) => (query.state.data?.joinable ? false : 30_000),
  });
  const [accepted, setAccepted] = useState(false);
  const [access, setAccess] = useState<RoomAccess | null>(null);
  const [state, setState] = useState<'waiting' | 'in' | 'left' | 'failed'>('waiting');
  const join = useMutation(
    trpc.meetings.join.mutationOptions({
      onSuccess: (room) => {
        setAccess(room);
        setState('in');
      },
      onError: failed,
    }),
  );
  const leave = useCallback(() => setState('left'), []);
  const fail = useCallback(() => setState('failed'), []);
  const when = format.dateTime(meeting.startsAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const heading = (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{meeting.subject}</h1>
      <p className="mt-1 text-sm text-slate first-letter:uppercase">
        {when} · {panel('minutes', { minutes: meeting.durationMinutes })}
      </p>
    </div>
  );
  const notice = (text: string) => (
    <>
      {heading}
      <p className="rounded-2xl border border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">{text}</p>
    </>
  );

  if (meeting.status === 'CANCELLED') return notice(t('cancelled'));
  if (meeting.past) return notice(t('over'));
  if (!meeting.configured) return notice(t('unconfigured'));
  if (!meeting.joinable) return notice(t('notOpen'));

  if (state === 'in' && access) {
    return (
      <>
        {heading}
        <MeetingCall access={access} onLeave={leave} onFailed={fail} />
      </>
    );
  }

  const needsConsent = meeting.recording && !meeting.consentedAt;
  return (
    <>
      {heading}
      <div className="grid gap-4 rounded-2xl border border-fog-light bg-white p-6 shadow-sm">
        {state === 'left' ? <p className="text-sm text-slate">{t('left')}</p> : null}
        {state === 'failed' ? (
          <p role="alert" className="text-sm text-crimson">
            {t('failed')}
          </p>
        ) : null}
        {meeting.recording ? (
          <div className="rounded-xl bg-off-white p-4">
            <h2 className="flex items-center gap-2 font-semibold text-navy-deep">
              <Circle aria-hidden={true} className="size-3 fill-rouge text-rouge" />
              {t('recordedTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate">{t('recordedBody')}</p>
            {needsConsent ? (
              <label htmlFor={`${ids}-accept`} className="mt-3 flex items-start gap-3 text-sm font-semibold text-navy-deep">
                <input
                  id={`${ids}-accept`}
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-0.5 size-5 accent-rouge"
                />
                {t('accept')}
              </label>
            ) : meeting.consentedAt ? (
              <p className="mt-2 text-xs text-slate">
                {t('acceptedOn', {
                  date: format.dateTime(meeting.consentedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate">{t('notRecorded')}</p>
        )}
        <button
          type="button"
          disabled={join.isPending || (needsConsent && !accepted)}
          onClick={() => join.mutate({ id: meeting.id, accepted })}
          className="inline-flex h-12 items-center justify-center gap-2 justify-self-start rounded-full bg-rouge px-6 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Video aria-hidden={true} className="size-4" />
          {join.isPending ? t('joining') : state === 'left' ? t('rejoin') : t('join')}
        </button>
      </div>
    </>
  );
}

function RoomSkeleton(): ReactNode {
  const t = useTranslations('Meetings.room');
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-9 w-72 rounded-lg" />
      <Skeleton aria-hidden={true} className="h-56 rounded-2xl" />
    </div>
  );
}
