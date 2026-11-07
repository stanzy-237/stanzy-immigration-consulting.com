'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { PeoplePicker, type InvitedPerson } from '@/features/meetings/components/meeting-parts';
import { DESCRIPTION_MAX, DURATIONS, SUBJECT_MAX } from '@/features/meetings/lib/meeting-schema';
import { DossierPicker, type DossierOption } from '@/features/shared/components/dossier-picker';
import { useTRPC } from '@/trpc/client';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const label = 'grid gap-1 text-sm font-semibold text-navy-deep';

/** A Réunion being changed: what the form starts from. */
export type EditedMeeting = {
  id: string;
  subject: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number;
  recording: boolean;
  participants: { account: InvitedPerson }[];
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Plans a Réunion or changes one: subject, description, day and time (this
 * device's), duration, recording, who is invited, and the Dossier it is
 * about (fixed when planned from a Dossier, where its Client is invited by
 * itself). Calls `onDone` with the new Réunion once planned.
 */
export function MeetingForm({
  meeting,
  dossierId,
  onDone,
  onCancel,
}: {
  meeting: EditedMeeting | null;
  /** Planned from this Dossier: no Dossier to choose. */
  dossierId?: string;
  onDone: (created: { id: string; inviteToken: string; subject: string; startsAt: Date } | null) => void;
  onCancel: () => void;
}): ReactNode {
  const t = useTranslations('Meetings');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useMeetingErrors();
  // A new Réunion starts tomorrow at 10:00, on this device's clock.
  const [initial] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return meeting?.startsAt ?? tomorrow;
  });
  const [subject, setSubject] = useState(meeting?.subject ?? '');
  const [description, setDescription] = useState(meeting?.description ?? '');
  const [date, setDate] = useState(dateInput(initial));
  const [time, setTime] = useState(timeInput(initial));
  const [duration, setDuration] = useState<number>(meeting?.durationMinutes ?? 30);
  const [recording, setRecording] = useState(meeting?.recording ?? true);
  const [people, setPeople] = useState<InvitedPerson[]>(meeting?.participants.map(({ account }) => account) ?? []);
  const [dossier, setDossier] = useState<DossierOption | null>(null);
  const [inPast, setInPast] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: trpc.meetings.pathKey() });
  const schedule = useMutation(
    trpc.meetings.schedule.mutationOptions({
      onSuccess: (created, input) => {
        refresh();
        toast.add({ title: t('toast.scheduled'), type: 'success' });
        onDone({ ...created, subject: input.subject, startsAt: input.startsAt });
      },
      onError: failed,
    }),
  );
  const update = useMutation(
    trpc.meetings.update.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.updated'), type: 'success' });
        onDone(null);
      },
      onError: failed,
    }),
  );
  const pending = schedule.isPending || update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const startsAt = new Date(`${date}T${time}`);
    const moved = !meeting || startsAt.getTime() !== meeting.startsAt.getTime();
    const past = Number.isNaN(startsAt.getTime()) || (moved && startsAt.getTime() < Date.now());
    setInPast(past);
    if (past) return;
    const fields = {
      subject: subject.trim(),
      description: description.trim() || null,
      startsAt,
      durationMinutes: duration,
      recording,
      participantIds: people.map((person) => person.id),
    };
    if (meeting) update.mutate({ id: meeting.id, ...fields });
    else schedule.mutate({ dossierId: dossierId ?? dossier?.id ?? null, ...fields });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">
          {meeting ? t('form.editTitle') : t('form.newTitle')}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('form.body')}</DialogDescription>
      </DialogHeader>
      <label htmlFor={`${ids}-subject`} className={label}>
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
      <label htmlFor={`${ids}-description`} className={label}>
        {t('hub.form.description')}
        <textarea
          id={`${ids}-description`}
          rows={2}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${ids}-date`} className={label}>
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
        <label htmlFor={`${ids}-time`} className={label}>
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
      <label htmlFor={`${ids}-duration`} className={label}>
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
      <PeoplePicker value={people} onChange={setPeople} />
      {!dossierId && !meeting ? (
        <DossierPicker id={`${ids}-dossier`} value={dossier} invalid={false} onChange={setDossier} />
      ) : null}
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
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          {t('form.cancel')}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          {pending ? t('form.saving') : meeting ? t('form.saveEdit') : t('form.save')}
        </button>
      </div>
    </form>
  );
}
