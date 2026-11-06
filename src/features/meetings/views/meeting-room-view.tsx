'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Circle, Copy, FolderOpen, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
// The consultant's room is on admin.<site>'s short paths (see dashboard-host).
import NextLink from 'next/link';
import { useCallback, useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { ConsultantPart } from '@/features/meetings/components/dossier-meetings';
import type { RoomAccess } from '@/features/meetings/components/meeting-call';
import { Avatars, useCopyInvitation } from '@/features/meetings/components/meeting-parts';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

// Stream's call runs in the browser only (camera, micro, WebRTC).
const MeetingCall = dynamic(() => import('@/features/meetings/components/meeting-call').then((m) => m.MeetingCall), {
  ssr: false,
});

type Viewer = 'consultant' | 'client';

const backClass = 'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep';

/**
 * A Réunion's room (#94), for the consultant in the Tableau de bord or for
 * someone invited in « Mon espace »: when it is recorded, « Cette réunion
 * est enregistrée » to accept first (once, saved with the time); then the
 * call. Before the room opens, once it is over, or cancelled, it says so.
 * The consultant also sees who waits to be let in, the invitation to copy,
 * and the notes, Enregistrements and Transcriptions.
 */
export function MeetingRoomView({ meetingId, viewer }: { meetingId: string; viewer: Viewer }): ReactNode {
  const content = (
    <div className="mx-auto grid max-w-6xl min-w-0 grid-cols-1 gap-4">
      <QueryBoundary fallback={<RoomSkeleton />}>
        <Room meetingId={meetingId} viewer={viewer} />
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

function Room({ meetingId, viewer }: { meetingId: string; viewer: Viewer }): ReactNode {
  const t = useTranslations('Meetings');
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useMeetingErrors();
  const copy = useCopyInvitation();
  const consultant = viewer === 'consultant';
  const [accepted, setAccepted] = useState(false);
  const [access, setAccess] = useState<RoomAccess | null>(null);
  const [state, setState] = useState<'waiting' | 'in' | 'left' | 'ended' | 'failed'>('waiting');
  // When the consultant came out of a recorded call: its files come a minute or two later.
  const [outAt, setOutAt] = useState<number | null>(null);
  // Waiting for the room to open: asked again every 30 seconds. Out of a recorded call, every
  // 20 seconds for 5 minutes, until its Enregistrement shows.
  const { data: meeting } = useSuspenseQuery({
    ...trpc.meetings.room.queryOptions({ id: meetingId }),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (outAt !== null && data.recording && data.consultant && Date.now() - outAt < 5 * 60_000) return 20_000;
      return data.joinable ? false : 30_000;
    },
  });
  const join = useMutation(
    trpc.meetings.join.mutationOptions({
      onSuccess: (room) => {
        setAccess(room);
        setState('in');
      },
      onError: failed,
    }),
  );
  const end = useMutation(trpc.meetings.end.mutationOptions({ onError: failed }));
  const leave = useCallback(() => {
    setState((current) => (current === 'ended' ? current : 'left'));
    setOutAt(Date.now());
  }, []);
  const ended = useCallback(() => {
    setState('ended');
    setOutAt(Date.now());
    void queryClient.invalidateQueries({ queryKey: trpc.meetings.pathKey() });
  }, [queryClient, trpc]);
  const fail = useCallback(() => setState('failed'), []);
  const personal = meeting.kind === 'PERSONAL';
  const when = format.dateTime(meeting.startsAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const back = consultant ? (
    <NextLink href="/reunions" className={backClass}>
      <ArrowLeft aria-hidden={true} className="size-4" />
      {t('hub.room.back')}
    </NextLink>
  ) : (
    <Link
      href={meeting.dossierId ? `/mon-espace/dossiers/${meeting.dossierId}?onglet=reunions` : '/mon-espace'}
      className={backClass}
    >
      <ArrowLeft aria-hidden={true} className="size-4" />
      {t('room.back')}
    </Link>
  );

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold break-words text-navy-deep md:text-3xl">{meeting.subject}</h1>
        {personal ? null : (
          <p className="mt-1 text-sm text-slate first-letter:uppercase">
            {when} · {t('panel.minutes', { minutes: meeting.durationMinutes })}
          </p>
        )}
        {meeting.description ? (
          <p className="mt-2 text-sm whitespace-pre-line text-navy-deep">{meeting.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Avatars people={meeting.participants.map(({ account }) => account)} />
        {consultant && meeting.consultant ? (
          <>
            <button
              type="button"
              onClick={() => copy({ ...meeting, inviteToken: meeting.consultant?.inviteToken ?? null })}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light"
            >
              <Copy aria-hidden={true} className="size-4" />
              {t('hub.room.copyInvite')}
            </button>
            {meeting.consultant.dossier ? (
              <NextLink
                href={`/dossiers/${meeting.consultant.dossier.id}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light"
              >
                <FolderOpen aria-hidden={true} className="size-4" />
                {t('hub.room.dossier')}
              </NextLink>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
  const notice = (text: string) => (
    <p className="rounded-2xl border border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">{text}</p>
  );
  const details =
    consultant && meeting.consultant ? (
      <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <ConsultantPart
          meeting={{
            id: meeting.id,
            subject: meeting.subject,
            recording: meeting.recording,
            notes: meeting.consultant.notes,
            recordings: meeting.consultant.recordings,
          }}
          upcoming={!meeting.past}
        />
      </section>
    ) : null;

  let body: ReactNode;
  if (state === 'in' && access) {
    body = (
      <MeetingCall
        access={access}
        subject={meeting.subject}
        host={consultant}
        aside={consultant ? <Waiting meetingId={meeting.id} /> : undefined}
        onLeave={leave}
        onEnded={ended}
        onEndForAll={async () => {
          await end.mutateAsync({ id: meeting.id });
          ended();
        }}
        onFailed={fail}
      />
    );
  } else if (state === 'ended') body = notice(t('hub.room.ended'));
  else if (meeting.status === 'CANCELLED') body = notice(t('room.cancelled'));
  else if (meeting.past) body = notice(t('room.over'));
  else if (!meeting.configured) body = notice(t('room.unconfigured'));
  else if (!meeting.joinable) body = notice(t('room.notOpen'));
  else {
    const needsConsent = meeting.recording && !meeting.consentedAt;
    body = (
      <div className="grid gap-4 rounded-2xl border border-fog-light bg-white p-6 shadow-sm">
        {state === 'left' ? <p className="text-sm text-slate">{t('room.left')}</p> : null}
        {state === 'failed' ? (
          <p role="alert" className="text-sm text-crimson">
            {t('room.failed')}
          </p>
        ) : null}
        {meeting.recording ? (
          <div className="rounded-xl bg-off-white p-4">
            <h2 className="flex items-center gap-2 font-semibold text-navy-deep">
              <Circle aria-hidden={true} className="size-3 fill-rouge text-rouge" />
              {t('room.recordedTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate">{t('room.recordedBody')}</p>
            {needsConsent ? (
              <label htmlFor={`${ids}-accept`} className="mt-3 flex items-start gap-3 text-sm font-semibold text-navy-deep">
                <input
                  id={`${ids}-accept`}
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-0.5 size-5 accent-rouge"
                />
                {t('room.accept')}
              </label>
            ) : meeting.consentedAt ? (
              <p className="mt-2 text-xs text-slate">
                {t('room.acceptedOn', {
                  date: format.dateTime(meeting.consentedAt, {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate">{t('room.notRecorded')}</p>
        )}
        <button
          type="button"
          disabled={join.isPending || (needsConsent && !accepted)}
          onClick={() => join.mutate({ id: meeting.id, accepted })}
          className="inline-flex h-12 items-center justify-center gap-2 justify-self-start rounded-full bg-rouge px-6 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Video aria-hidden={true} className="size-4" />
          {join.isPending ? t('room.joining') : state === 'left' ? t('room.rejoin') : t('room.join')}
        </button>
      </div>
    );
  }

  return (
    <>
      {back}
      {heading}
      {body}
      {state === 'in' ? null : details}
    </>
  );
}

/** For the consultant in the call: those who asked to join with the link, to let in or refuse. */
function Waiting({ meetingId }: { meetingId: string }): ReactNode {
  const t = useTranslations('Meetings.hub.waiting');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useMeetingErrors();
  const { data: waiting } = useQuery({
    ...trpc.meetings.invitation.waiting.queryOptions({ id: meetingId }),
    refetchInterval: 4000,
  });
  const decide = useMutation(
    trpc.meetings.invitation.decide.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: trpc.meetings.invitation.waiting.queryKey({ id: meetingId }) }),
      onError: failed,
    }),
  );
  if (!waiting || waiting.length === 0) return null;
  return (
    <section aria-labelledby={`${meetingId}-waiting`} className="rounded-xl bg-white p-3 text-navy-deep">
      <h2 id={`${meetingId}-waiting`} className="mb-2 text-sm font-bold">
        {t('title')}
      </h2>
      <ul className="grid gap-2">
        {waiting.map((request) => (
          <li key={request.id} className="grid gap-1.5">
            <p className="text-sm font-semibold">
              {request.account.name} <span className="font-normal text-slate">· {request.account.email}</span>
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: request.id, admit: true })}
                aria-label={t('admitLabel', { name: request.account.name })}
                className="inline-flex h-9 items-center rounded-full bg-rouge px-3 text-xs font-semibold text-white hover:bg-crimson disabled:opacity-50"
              >
                {t('admit')}
              </button>
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => {
                  decide.mutate({ id: request.id, admit: false });
                  toast.add({ title: t('refuse'), type: 'info' });
                }}
                aria-label={t('refuseLabel', { name: request.account.name })}
                className="inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold text-navy-deep hover:bg-off-white disabled:opacity-50"
              >
                {t('refuse')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
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
