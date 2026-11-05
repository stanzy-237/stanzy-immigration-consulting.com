'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Copy, Pencil, RefreshCw, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingsNav, useCopyInvitation } from '@/features/meetings/components/meeting-parts';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { useSiteOrigin } from '@/features/meetings/hooks/use-site-origin';
import { consultantRoomPath, invitationPath, SUBJECT_MAX } from '@/features/meetings/lib/meeting-schema';
import { useTRPC } from '@/trpc/client';

const button =
  'inline-flex h-11 items-center gap-2 rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light';

/**
 * « Salle personnelle » (#94): the consultant's room, always open, with its
 * own link. Those not invited ask to enter and wait to be let in.
 */
export function PersonalRoomView(): ReactNode {
  const t = useTranslations('Meetings.hub');
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <MeetingsNav page="personal" title={t('nav.personal')} />
      <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-64 rounded-2xl" />}>
        <PersonalRoom />
      </QueryBoundary>
    </div>
  );
}

function PersonalRoom(): ReactNode {
  const t = useTranslations('Meetings.hub.personal');
  const ids = useId();
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useMeetingErrors();
  const copy = useCopyInvitation();
  const { data: room } = useSuspenseQuery(trpc.meetings.dashboard.personalRoom.queryOptions());
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [subject, setSubject] = useState(room.subject);
  const [recording, setRecording] = useState(room.recording);
  const update = useMutation(
    trpc.meetings.dashboard.updatePersonalRoom.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.meetings.dashboard.personalRoom.queryKey() });
        setEditing(false);
        setRenewing(false);
      },
      onError: failed,
    }),
  );
  // The site's address is only known in the browser (the dashboard is on admin.<site>).
  const origin = useSiteOrigin();
  const link = origin ? `${origin}/${locale}${invitationPath(room.inviteToken)}` : '';

  return (
    <section className="grid gap-6 rounded-2xl border border-fog-light bg-white p-6 shadow-sm">
      <p className="text-sm text-slate">{t('intro')}</p>
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ subject: subject.trim(), recording, newLink: false });
          }}
        >
          <label htmlFor={`${ids}-subject`} className="grid gap-1 text-sm font-semibold text-navy-deep">
            {t('topic')}
            <input
              id={`${ids}-subject`}
              required={true}
              minLength={2}
              maxLength={SUBJECT_MAX}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
            />
          </label>
          <label htmlFor={`${ids}-recording`} className="flex items-center gap-3 text-sm font-semibold text-navy-deep">
            <input
              id={`${ids}-recording`}
              type="checkbox"
              checked={recording}
              onChange={(event) => setRecording(event.target.checked)}
              className="size-5 accent-rouge"
            />
            {t('recording')}
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="inline-flex h-11 items-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {t('save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={button}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-4">
          <div className="grid gap-1 sm:flex sm:gap-8">
            <dt className="text-sm text-slate sm:w-40">{t('topic')}</dt>
            <dd className="font-semibold text-navy-deep">
              {room.subject} · <span className="font-normal text-slate">{room.recording ? t('recorded') : t('notRecorded')}</span>
            </dd>
          </div>
          <div className="grid gap-1 sm:flex sm:gap-8">
            <dt className="text-sm text-slate sm:w-40">{t('link')}</dt>
            <dd className="font-semibold break-all text-rouge">{link}</dd>
          </div>
        </dl>
      )}
      {editing ? null : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={consultantRoomPath(room.id)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
          >
            <Video aria-hidden={true} className="size-4" />
            {t('start')}
          </Link>
          <button type="button" onClick={() => copy(room)} className={button}>
            <Copy aria-hidden={true} className="size-4" />
            {t('copy')}
          </button>
          <button type="button" onClick={() => setEditing(true)} className={button}>
            <Pencil aria-hidden={true} className="size-4" />
            {t('edit')}
          </button>
          <button type="button" onClick={() => setRenewing(true)} className={button}>
            <RefreshCw aria-hidden={true} className="size-4" />
            {t('newLink')}
          </button>
        </div>
      )}

      <AlertDialog open={renewing} onOpenChange={setRenewing}>
        <AlertDialogContent className="gap-4 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('newLinkTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('newLinkBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ subject: room.subject, recording: room.recording, newLink: true })}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {t('confirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
