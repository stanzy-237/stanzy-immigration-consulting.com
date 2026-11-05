'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Copy, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { MeetingForm } from '@/features/meetings/components/meeting-form';
import { PeoplePicker, useCopyInvitation, type InvitedPerson } from '@/features/meetings/components/meeting-parts';
import { consultantRoomPath, SUBJECT_MAX } from '@/features/meetings/lib/meeting-schema';
import { useTRPC } from '@/trpc/client';

const primary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50';
const secondary =
  'inline-flex h-11 items-center justify-center rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light';

/** « Planifier »: the form, then « Réunion planifiée » with the invitation to copy. */
export function PlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Meetings.hub.created');
  const copy = useCopyInvitation();
  const [created, setCreated] = useState<{ id: string; inviteToken: string; subject: string; startsAt: Date } | null>(
    null,
  );
  const close = () => {
    onOpenChange(false);
    setCreated(null);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent showCloseButton={false} className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-lg">
        {created ? (
          <div className="grid justify-items-center gap-4 text-center">
            <BadgeCheck aria-hidden={true} className="size-14 text-rouge" />
            <DialogHeader className="items-center">
              <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</DialogTitle>
              <DialogDescription className="text-sm text-slate">{t('body')}</DialogDescription>
            </DialogHeader>
            <button type="button" onClick={() => copy(created)} className={`w-full ${primary}`}>
              <Copy aria-hidden={true} className="size-4" />
              {t('copy')}
            </button>
            <button type="button" onClick={close} className={`w-full ${secondary}`}>
              {t('close')}
            </button>
          </div>
        ) : open ? (
          <MeetingForm
            meeting={null}
            onCancel={close}
            onDone={(result) => (result ? setCreated(result) : close())}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** « Nouvelle réunion »: a subject if wanted, who to invite, then straight into the room. */
export function InstantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-lg">
        {open ? <InstantForm onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function InstantForm({ onCancel }: { onCancel: () => void }): ReactNode {
  const t = useTranslations('Meetings');
  const ids = useId();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const failed = useMeetingErrors();
  const [subject, setSubject] = useState('');
  const [people, setPeople] = useState<InvitedPerson[]>([]);
  const [recording, setRecording] = useState(true);
  const start = useMutation(
    trpc.meetings.instant.mutationOptions({
      onSuccess: ({ id }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.meetings.pathKey() });
        router.push(consultantRoomPath(id));
      },
      onError: failed,
    }),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    start.mutate({ subject: subject.trim(), dossierId: null, participantIds: people.map(({ id }) => id), recording });
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('hub.instant.title')}</DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('hub.instant.body')}</DialogDescription>
      </DialogHeader>
      <label htmlFor={`${ids}-subject`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('hub.instant.subject')}
        <input
          id={`${ids}-subject`}
          maxLength={SUBJECT_MAX}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
        />
      </label>
      <PeoplePicker value={people} onChange={setPeople} />
      <label htmlFor={`${ids}-recording`} className="flex items-start gap-3 text-sm text-navy-deep">
        <input
          id={`${ids}-recording`}
          type="checkbox"
          checked={recording}
          onChange={(event) => setRecording(event.target.checked)}
          className="mt-0.5 size-5 accent-rouge"
        />
        <span className="font-semibold">{t('form.recording')}</span>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondary}>
          {t('form.cancel')}
        </button>
        <button type="submit" disabled={start.isPending} className={primary}>
          <Video aria-hidden={true} className="size-4" />
          {start.isPending ? t('hub.instant.starting') : t('hub.instant.start')}
        </button>
      </div>
    </form>
  );
}

/** The token in an invitation link (…/reunion/<token>), or the token itself pasted alone. */
export function tokenOf(text: string): string | null {
  const value = text.trim();
  const match = /\/reunion\/([A-Za-z0-9_-]{16,100})/.exec(value) ?? /^([A-Za-z0-9_-]{16,100})$/.exec(value);
  return match ? match[1]! : null;
}

/** « Rejoindre »: paste an invitation link, open its room. */
export function JoinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Meetings.hub.join');
  const ids = useId();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [link, setLink] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const token = tokenOf(link);
    if (!token) return setInvalid(true);
    setPending(true);
    try {
      const meeting = await queryClient.fetchQuery(trpc.meetings.invitation.get.queryOptions({ token }));
      router.push(consultantRoomPath(meeting.id));
    } catch {
      setInvalid(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4 p-6 sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</DialogTitle>
            <DialogDescription className="text-sm text-slate">{t('body')}</DialogDescription>
          </DialogHeader>
          <label htmlFor={`${ids}-link`} className="grid gap-1 text-sm font-semibold text-navy-deep">
            {t('link')}
            <input
              id={`${ids}-link`}
              required={true}
              value={link}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${ids}-error` : undefined}
              onChange={(event) => {
                setLink(event.target.value);
                setInvalid(false);
              }}
              className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
            />
          </label>
          {invalid ? (
            <p id={`${ids}-error`} className="-mt-2 text-sm text-crimson">
              {t('invalid')}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={secondary}>
              {t('cancel')}
            </button>
            <button type="submit" disabled={pending} className={primary}>
              {t('go')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
