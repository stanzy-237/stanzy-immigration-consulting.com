'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarPlus, Circle, FileText, Pencil, Search, Video, XCircle } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
// The consultant's links stay on admin.<site>'s short paths (see dashboard-host).
import NextLink from 'next/link';
import { useDeferredValue, useId, useState, type FormEvent, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import {
  clientRoomPath,
  consultantRoomPath,
  DURATIONS,
  isJoinable,
  isPast,
  NOTES_MAX,
  REASON_MAX,
  recordingUrl,
  SUBJECT_MAX,
} from '@/features/meetings/lib/meeting-schema';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Viewer = 'consultant' | 'client';
type Meeting = RouterOutputs['meetings']['forDossier']['meetings'][number];

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const area =
  'w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';
const primary =
  'inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50';
const secondary = 'inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white';
const small =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-navy-deep hover:bg-off-white';

/** Re-reads the Réunions after a change. */
function useRefresh(dossierId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: trpc.meetings.forDossier.queryKey({ dossierId }) });
}

/**
 * A Dossier's « Réunions » (#94): what is coming, with « Rejoindre » once the
 * room opens, and what happened. The consultant plans, moves and cancels, and
 * alone sees the notes, Enregistrements and Transcriptions.
 */
export function DossierMeetings({ dossierId, viewer }: { dossierId: string; viewer: Viewer }): ReactNode {
  const t = useTranslations('Meetings.panel');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.forDossier.queryOptions({ dossierId }));
  // The « Rejoindre » buttons open on time without a reload.
  const now = useNow({ updateInterval: 30_000 });
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);
  const [cancelling, setCancelling] = useState<Meeting | null>(null);
  const consultant = viewer === 'consultant';
  const upcoming = data.meetings
    .filter((meeting) => meeting.status === 'SCHEDULED' && !isPast(meeting, now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = data.meetings.filter((meeting) => !upcoming.includes(meeting));

  return (
    <section id="reunions" aria-labelledby="dossier-meetings" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="dossier-meetings" className="font-heading text-xl font-bold text-navy-deep">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-slate">{consultant ? t('introConsultant') : t('introClient')}</p>
        </div>
        {consultant && data.open ? (
          <button type="button" onClick={() => setEditing('new')} className={primary}>
            <CalendarPlus aria-hidden={true} className="size-4" />
            {t('plan')}
          </button>
        ) : null}
      </div>
      {!data.configured ? <p className="mt-3 rounded-xl bg-honey-tint px-4 py-2 text-sm text-honey">{t('unconfigured')}</p> : null}

      <div className="mt-4 grid gap-6">
        {data.meetings.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-8 text-center text-sm text-slate">
            {t('empty')}
          </p>
        ) : null}
        {upcoming.length > 0 ? (
          <MeetingList title={t('upcoming')}>
            {upcoming.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                dossierId={dossierId}
                meeting={meeting}
                viewer={viewer}
                open={data.open}
                now={now}
                onEdit={() => setEditing(meeting)}
                onCancel={() => setCancelling(meeting)}
              />
            ))}
          </MeetingList>
        ) : null}
        {past.length > 0 ? (
          <MeetingList title={t('past')}>
            {past.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                dossierId={dossierId}
                meeting={meeting}
                viewer={viewer}
                open={data.open}
                now={now}
                onEdit={() => setEditing(meeting)}
                onCancel={() => setCancelling(meeting)}
              />
            ))}
          </MeetingList>
        ) : null}
        {consultant && data.meetings.some((meeting) => meeting.recordings.length > 0) ? (
          <TranscriptSearch dossierId={dossierId} />
        ) : null}
      </div>

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent showCloseButton={false} className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-lg">
          {editing !== null ? (
            <MeetingForm
              dossierId={dossierId}
              meeting={editing === 'new' ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <CancelDialog dossierId={dossierId} meeting={cancelling} onClose={() => setCancelling(null)} />
    </section>
  );
}

function MeetingList({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate">{title}</h3>
      <ul className="grid gap-2">{children}</ul>
    </div>
  );
}

function MeetingCard({
  dossierId,
  meeting,
  viewer,
  open,
  now,
  onEdit,
  onCancel,
}: {
  dossierId: string;
  meeting: Meeting;
  viewer: Viewer;
  open: boolean;
  now: Date;
  onEdit: () => void;
  onCancel: () => void;
}): ReactNode {
  const t = useTranslations('Meetings.panel');
  const format = useFormatter();
  const consultant = viewer === 'consultant';
  const cancelled = meeting.status === 'CANCELLED';
  const joinable = open && !cancelled && isJoinable(meeting, now);
  const upcoming = !cancelled && !isPast(meeting, now);
  const when = format.dateTime(meeting.startsAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const joinClass = `${primary} h-10`;

  return (
    <li className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy-deep">{meeting.subject}</span>
            {cancelled ? (
              <span className="rounded-full bg-fog-light px-2.5 py-0.5 text-xs font-semibold text-slate">
                {t('cancelled')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-off-white px-2.5 py-0.5 text-xs font-semibold text-slate">
                {meeting.recording ? <Circle aria-hidden={true} className="size-2.5 fill-rouge text-rouge" /> : null}
                {meeting.recording ? t('recorded') : t('notRecorded')}
              </span>
            )}
          </p>
          <p className="text-sm text-slate first-letter:uppercase">
            {when} · {t('minutes', { minutes: meeting.durationMinutes })}
          </p>
          {cancelled && meeting.cancelReason ? (
            <p className="text-sm text-slate">{t('reason', { reason: meeting.cancelReason })}</p>
          ) : null}
        </div>
        {upcoming ? (
          <div className="flex flex-wrap items-center gap-1">
            {joinable ? (
              consultant ? (
                <NextLink
                  href={consultantRoomPath(dossierId, meeting.id)}
                  aria-label={t('joinLabel', { subject: meeting.subject })}
                  className={joinClass}
                >
                  <Video aria-hidden={true} className="size-4" />
                  {t('join')}
                </NextLink>
              ) : (
                <Link
                  href={clientRoomPath(dossierId, meeting.id)}
                  aria-label={t('joinLabel', { subject: meeting.subject })}
                  className={joinClass}
                >
                  <Video aria-hidden={true} className="size-4" />
                  {t('join')}
                </Link>
              )
            ) : (
              <span className="text-xs text-slate">{t('opensSoon')}</span>
            )}
            {consultant && open ? (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label={t('editLabel', { subject: meeting.subject })}
                  className={small}
                >
                  <Pencil aria-hidden={true} className="size-4" />
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label={t('cancelLabel', { subject: meeting.subject })}
                  className={`${small} text-rouge`}
                >
                  <XCircle aria-hidden={true} className="size-4" />
                  {t('cancel')}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {consultant && !cancelled ? <ConsultantPart dossierId={dossierId} meeting={meeting} upcoming={upcoming} /> : null}
    </li>
  );
}

/** What only the consultant sees under a Réunion: notes, and once held, its files. */
function ConsultantPart({
  dossierId,
  meeting,
  upcoming,
}: {
  dossierId: string;
  meeting: Meeting;
  upcoming: boolean;
}): ReactNode {
  const t = useTranslations('Meetings.panel');
  const toasts = useTranslations('Meetings.toast');
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useMeetingErrors();
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [reading, setReading] = useState<string | null>(null);
  const save = useMutation(
    trpc.meetings.saveNotes.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: toasts('notes'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const recordings = meeting.recordings.filter((file) => file.kind === 'RECORDING');
  const transcripts = meeting.recordings.filter((file) => file.kind === 'TRANSCRIPTION' && file.text);

  return (
    <div className="mt-3 grid gap-3 border-t border-fog-light pt-3">
      {!upcoming ? (
        meeting.recording && meeting.recordings.length === 0 ? (
          <p className="text-xs text-slate">{t('noFiles')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {recordings.map((file) => (
              <a
                key={file.id}
                href={recordingUrl(file.id)}
                target="_blank"
                rel="noopener"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-fog-light px-3 text-sm font-semibold text-navy-deep hover:border-navy-deep"
              >
                <Video aria-hidden={true} className="size-4" />
                {t('recording', {
                  date: format.dateTime(file.startedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                })}
              </a>
            ))}
            {transcripts.map((file) => (
              <button
                key={file.id}
                type="button"
                aria-expanded={reading === file.id}
                onClick={() => setReading(reading === file.id ? null : file.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-fog-light px-3 text-sm font-semibold text-navy-deep hover:border-navy-deep"
              >
                <FileText aria-hidden={true} className="size-4" />
                {reading === file.id ? t('hideTranscript') : t('showTranscript')}
              </button>
            ))}
          </div>
        )
      ) : null}
      {transcripts
        .filter((file) => file.id === reading)
        .map((file) => (
          <div key={file.id} className="max-h-80 overflow-y-auto rounded-xl bg-off-white p-3">
            <p className="mb-1 text-xs font-semibold text-slate">{t('transcription')}</p>
            <p className="text-sm whitespace-pre-line text-navy-deep">{file.text}</p>
          </div>
        ))}
      <form
        className="grid gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ id: meeting.id, notes });
        }}
      >
        <label htmlFor={`${ids}-notes`} className="text-xs font-semibold text-slate">
          {t('notes')}
        </label>
        <textarea
          id={`${ids}-notes`}
          rows={2}
          maxLength={NOTES_MAX}
          value={notes}
          aria-label={t('notesLabel', { subject: meeting.subject })}
          onChange={(event) => setNotes(event.target.value)}
          className={area}
        />
        {notes !== (meeting.notes ?? '') ? (
          <button type="submit" disabled={save.isPending} className={`${small} justify-self-end`}>
            {t('notesSave')}
          </button>
        ) : null}
      </form>
    </div>
  );
}

/** Finds what was said in this Dossier's Réunions. */
function TranscriptSearch({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Meetings.panel');
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const { data: results, isFetching } = useQuery({
    ...trpc.meetings.search.queryOptions({ dossierId, query: deferred }),
    enabled: deferred.length >= 2,
  });
  return (
    <div className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <label htmlFor={`${ids}-search`} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-navy-deep">
        <Search aria-hidden={true} className="size-4" />
        {t('search')}
      </label>
      <input
        id={`${ids}-search`}
        type="search"
        value={query}
        placeholder={t('searchPlaceholder')}
        onChange={(event) => setQuery(event.target.value)}
        className={field}
      />
      {deferred.length >= 2 && results ? (
        <div role="status" aria-busy={isFetching} className="mt-3 grid gap-3">
          {results.length === 0 ? (
            <p className="text-sm text-slate">{t('noResults')}</p>
          ) : (
            <>
              <p className="text-xs text-slate">{t('results', { count: results.length })}</p>
              {results.map((result) => (
                <div key={result.id}>
                  <p className="text-sm font-semibold text-navy-deep">
                    {result.meeting.subject} ·{' '}
                    {format.dateTime(result.meeting.startsAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <ul className="mt-1 grid gap-1">
                    {result.lines.map((line, index) => (
                      <li key={index} className="rounded-lg bg-off-white px-2.5 py-1.5 text-sm text-navy-deep">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Plans a Réunion, or moves one: subject, day and time (this device's), duration, recording. */
function MeetingForm({
  dossierId,
  meeting,
  onDone,
}: {
  dossierId: string;
  meeting: Meeting | null;
  onDone: () => void;
}): ReactNode {
  const t = useTranslations('Meetings');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useMeetingErrors();
  // A new Réunion starts tomorrow at 10:00, on this device's clock.
  const [initial] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return meeting?.startsAt ?? tomorrow;
  });
  const [subject, setSubject] = useState(meeting?.subject ?? '');
  const [date, setDate] = useState(dateInput(initial));
  const [time, setTime] = useState(timeInput(initial));
  const [duration, setDuration] = useState<number>(meeting?.durationMinutes ?? 30);
  const [recording, setRecording] = useState(meeting?.recording ?? true);
  const [inPast, setInPast] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const done = (title: string) => ({
    onSuccess: () => {
      refresh();
      toast.add({ title, type: 'success' as const });
      onDone();
    },
    onError: failed,
  });
  const schedule = useMutation(trpc.meetings.schedule.mutationOptions(done(t('toast.scheduled'))));
  const update = useMutation(trpc.meetings.update.mutationOptions(done(t('toast.updated'))));
  const pending = schedule.isPending || update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const startsAt = new Date(`${date}T${time}`);
    const moved = !meeting || startsAt.getTime() !== meeting.startsAt.getTime();
    const past = Number.isNaN(startsAt.getTime()) || (moved && startsAt.getTime() < Date.now());
    setInPast(past);
    if (past) return;
    const fields = { subject: subject.trim(), startsAt, durationMinutes: duration, recording };
    if (meeting) update.mutate({ id: meeting.id, ...fields });
    else schedule.mutate({ dossierId, ...fields });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">
          {meeting ? t('form.editTitle') : t('form.newTitle')}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('form.body')}</DialogDescription>
      </DialogHeader>
      <label htmlFor={`${ids}-subject`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('form.subject')}
        <input
          id={`${ids}-subject`}
          required={true}
          minLength={2}
          maxLength={SUBJECT_MAX}
          value={subject}
          placeholder={t('form.subjectPlaceholder')}
          onChange={(event) => setSubject(event.target.value)}
          className={field}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${ids}-date`} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('form.date')}
          <input
            id={`${ids}-date`}
            type="date"
            required={true}
            value={date}
            aria-invalid={inPast}
            aria-describedby={`${ids}-zone`}
            onChange={(event) => setDate(event.target.value)}
            className={field}
          />
        </label>
        <label htmlFor={`${ids}-time`} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('form.time')}
          <input
            id={`${ids}-time`}
            type="time"
            required={true}
            step={300}
            value={time}
            aria-invalid={inPast}
            aria-describedby={`${ids}-zone`}
            onChange={(event) => setTime(event.target.value)}
            className={field}
          />
        </label>
      </div>
      <p id={`${ids}-zone`} className={inPast ? '-mt-2 text-sm text-crimson' : '-mt-2 text-xs text-slate'}>
        {inPast ? t('form.inPast') : t('form.timezone', { zone })}
      </p>
      <label htmlFor={`${ids}-duration`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('form.duration')}
        <select
          id={`${ids}-duration`}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          className={field}
        >
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t('form.minutes', { minutes })}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${ids}-recording`} className="flex items-start gap-3 text-sm text-navy-deep">
        <input
          id={`${ids}-recording`}
          type="checkbox"
          checked={recording}
          aria-describedby={`${ids}-recording-hint`}
          onChange={(event) => setRecording(event.target.checked)}
          className="mt-0.5 size-5 accent-rouge"
        />
        <span>
          <span className="font-semibold">{t('form.recording')}</span>
          <span id={`${ids}-recording-hint`} className="block text-xs text-slate">
            {t('form.recordingHint')}
          </span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={secondary}>
          {t('form.cancel')}
        </button>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? t('form.saving') : meeting ? t('form.saveEdit') : t('form.save')}
        </button>
      </div>
    </form>
  );
}

function CancelDialog({
  dossierId,
  meeting,
  onClose,
}: {
  dossierId: string;
  meeting: Meeting | null;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Meetings');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useMeetingErrors();
  const [reason, setReason] = useState('');
  const cancel = useMutation(
    trpc.meetings.cancel.mutationOptions({
      onSuccess: () => {
        refresh();
        setReason('');
        toast.add({ title: t('toast.cancelled'), type: 'success' });
        onClose();
      },
      onError: failed,
    }),
  );
  return (
    <AlertDialog open={meeting !== null} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="gap-4 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('cancelDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('cancelDialog.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor={`${ids}-reason`} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('cancelDialog.reason')}
          <textarea
            id={`${ids}-reason`}
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={area}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('cancelDialog.keep')}</AlertDialogCancel>
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => meeting && cancel.mutate({ id: meeting.id, reason: reason.trim() })}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('cancelDialog.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DossierMeetingsSkeleton(): ReactNode {
  const t = useTranslations('Meetings.panel');
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-7 w-40 rounded-lg" />
      <Skeleton aria-hidden={true} className="h-24 rounded-2xl" />
    </div>
  );
}
