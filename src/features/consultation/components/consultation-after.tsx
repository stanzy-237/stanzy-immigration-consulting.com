'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { toast } from '@/components/ui/toast';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { recordingUrl } from '@/features/meetings/lib/meeting-schema';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['consultationAdmin']['detail'];
type Note = Detail['clientNotes'][number];

const card = 'flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-6';
const cardTitle = 'font-heading text-h4 font-bold text-navy-deep';

/** « 2:40 », « 1:02:05 ». */
export const clockOfSeconds = (total: number): string => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** Refreshes the page's Consultation after a change, and says so. */
function useAfterMutation(id: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: trpc.consultationAdmin.detail.queryKey({ id }),
    });
}

/**
 * The left column of « 2 Après » (`Tableau de bord · Consultation · 2 Après`):
 * the Enregistrement with the repères of the notes for the Client (a click on
 * its bar places one), then three tabs: « Notes pour Aminata », Transcription,
 * « Vos notes privées » (`privateNotes`, never shown to the Client).
 */
export function AfterMain({ data, firstName, privateNotes }: { data: Detail; firstName: string; privateNotes: ReactNode }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const video = useRef<HTMLVideoElement>(null);
  const [tab, setTab] = useState<'notes' | 'transcript' | 'private'>('notes');
  const [draftAt, setDraftAt] = useState<number | null | undefined>(undefined);
  const tabs = [
    { key: 'notes' as const, label: t('tabs.notes', { name: firstName }) },
    { key: 'transcript' as const, label: t('tabs.transcript') },
    { key: 'private' as const, label: t('tabs.private') },
  ];
  const seek = (seconds: number) => {
    if (!video.current) return;
    video.current.currentTime = seconds;
    void video.current.play().catch(() => undefined);
  };
  const placeAt = (seconds: number) => {
    setTab('notes');
    setDraftAt(seconds);
  };

  return (
    <div className="flex flex-col gap-5">
      <Recording data={data} video={video} onPlace={placeAt} onSeek={seek} />
      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-6 overflow-x-auto border-b border-fog-light">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('-mb-px border-b-2 pb-2.5 font-heading text-body font-bold whitespace-nowrap', tab === key ? 'border-rouge text-navy-deep' : 'border-transparent text-slate')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'notes' ? (
        <ClientNotes data={data} firstName={firstName} draftAt={draftAt} onDraft={setDraftAt} onSeek={seek} currentTime={() => (video.current ? Math.floor(video.current.currentTime) : null)} />
      ) : null}
      {tab === 'transcript' ? (
        <section className={card}>
          {data.recording?.transcript ? (
            <p className="max-h-96 overflow-y-auto text-body-sm leading-6 whitespace-pre-wrap text-ink">{data.recording.transcript}</p>
          ) : (
            <p className="text-body-sm text-slate">{t('noTranscript')}</p>
          )}
        </section>
      ) : null}
      {tab === 'private' ? privateNotes : null}
    </div>
  );
}

function Recording({ data, video, onPlace, onSeek }: { data: Detail; video: RefObject<HTMLVideoElement | null>; onPlace: (seconds: number) => void; onSeek: (seconds: number) => void }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const recording = data.recording;
  if (!recording) {
    return (
      <section aria-label={t('recording')} className="flex min-h-48 flex-col justify-center gap-2 rounded-3xl bg-navy-deep p-6 text-white">
        <p className="font-heading text-body-lg font-bold">{t('noRecordingTitle')}</p>
        <p className="text-body-sm leading-5 text-white/75">{t('noRecording')}</p>
      </section>
    );
  }
  const markers = data.clientNotes.filter((n): n is Note & { atSeconds: number } => n.atSeconds !== null);
  return (
    <section aria-label={t('recording')} className="flex flex-col gap-3 overflow-hidden rounded-3xl bg-navy-deep p-4 text-white lg:p-5">
      <div className="flex items-center justify-between text-caption text-white/75">
        <span>{t('recordingLength', { length: clockOfSeconds(recording.seconds) })}</span>
        <span>{recording.transcript ? t('transcriptReady') : t('transcriptPending')}</span>
      </div>
      {}
      <video ref={video} src={recordingUrl(recording.id)} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-ink-deep" />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          aria-label={t('placeMarker')}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onPlace(Math.round(((event.clientX - rect.left) / rect.width) * recording.seconds));
          }}
          className="relative h-3 w-full cursor-copy rounded-full bg-white/15"
        />
        <div className="pointer-events-none relative -mt-4.5 h-3 w-full">
          {markers.map((note) => (
            <button
              key={note.id}
              type="button"
              aria-label={t('goTo', { time: clockOfSeconds(note.atSeconds) })}
              title={note.text}
              onClick={() => onSeek(note.atSeconds)}
              className="pointer-events-auto absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-white hover:bg-rose"
              style={{
                left: `${Math.min(100, (note.atSeconds / recording.seconds) * 100)}%`,
              }}
            />
          ))}
        </div>
        <p className="text-caption text-white/70">{t('markersHint')}</p>
      </div>
    </section>
  );
}

type NotesProps = {
  data: Detail;
  firstName: string;
  draftAt: number | null | undefined;
  onDraft: (at: number | null | undefined) => void;
  onSeek: (seconds: number) => void;
  currentTime: () => number | null;
};

/** « Notes pour Aminata »: what she reads under the video; each repère sends her to its moment. */
function ClientNotes({ data, firstName, draftAt, onDraft, onSeek, currentTime }: NotesProps): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const trpc = useTRPC();
  const refresh = useAfterMutation(data.id);
  const [editing, setEditing] = useState<string | null>(null);
  const remove = useMutation(
    trpc.consultationAdmin.removeClientNote.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.add({ title: t('noteRemoved'), type: 'success' });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  return (
    <section aria-label={t('tabs.notes', { name: firstName })} className={card}>
      <p className="text-caption text-slate">{t('notesLead')}</p>
      {data.clientNotes.length === 0 && draftAt === undefined ? <p className="text-body-sm text-slate">{t('noNotes', { name: firstName })}</p> : null}
      <ul className="flex flex-col gap-2.5">
        {data.clientNotes.map((note) =>
          editing === note.id ? (
            <li key={note.id}>
              <NoteEditor id={data.id} note={note} atSeconds={note.atSeconds} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={note.id} className="group flex items-start gap-3 rounded-2xl border border-fog-light px-3.5 py-3">
              {note.atSeconds !== null ? (
                <button type="button" onClick={() => onSeek(note.atSeconds!)} className="shrink-0 rounded-md bg-ice-blue px-2 py-0.5 text-caption font-bold text-ink tabular-nums">
                  {clockOfSeconds(note.atSeconds)}
                </button>
              ) : null}
              <p className="flex-1 text-body-sm leading-5 whitespace-pre-wrap text-ink">{note.text}</p>
              <span className="flex shrink-0 gap-1 opacity-60 group-hover:opacity-100">
                <button type="button" onClick={() => setEditing(note.id)} aria-label={t('editNote')} className="rounded-full p-1.5 hover:bg-off-white">
                  <Pencil aria-hidden={true} className="size-3.5 text-slate" strokeWidth={2.4} />
                </button>
                <button type="button" onClick={() => remove.mutate({ id: data.id, noteId: note.id })} aria-label={t('removeNote')} className="rounded-full p-1.5 hover:bg-off-white">
                  <X aria-hidden={true} className="size-3.5 text-slate" strokeWidth={2.4} />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {draftAt !== undefined ? (
        <NoteEditor id={data.id} atSeconds={draftAt} onDone={() => onDraft(undefined)} />
      ) : (
        <button type="button" onClick={() => onDraft(currentTime())} className="flex items-center gap-1.5 self-start text-body-sm font-bold text-rouge">
          <Plus aria-hidden={true} className="size-4" strokeWidth={2.6} />
          {data.recording ? t('addNoteAtVideo') : t('addNote')}
        </button>
      )}
    </section>
  );
}

function NoteEditor({ id, note, atSeconds, onDone }: { id: string; note?: Note; atSeconds: number | null; onDone: () => void }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const trpc = useTRPC();
  const refresh = useAfterMutation(id);
  const fieldId = useId();
  const [text, setText] = useState(note?.text ?? '');
  const save = useMutation(
    trpc.consultationAdmin.saveClientNote.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.add({ title: t('noteSaved'), type: 'success' });
        onDone();
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) save.mutate({ id, noteId: note?.id, atSeconds, text });
      }}
      className="flex flex-col gap-2.5 rounded-2xl border-2 border-navy-deep p-3"
    >
      <label htmlFor={fieldId} className="flex items-center gap-2 text-caption font-semibold text-slate">
        {atSeconds !== null ? <span className="rounded-md bg-ice-blue px-2 py-0.5 font-bold text-ink tabular-nums">{clockOfSeconds(atSeconds)}</span> : null}
        {t('noteLabel')}
      </label>
      {}
      <textarea id={fieldId} autoFocus={true} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="resize-y text-body-sm leading-5 text-ink outline-none" />
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-full px-3 py-1.5 text-body-sm font-semibold text-slate">
          {t('cancel')}
        </button>
        <button type="submit" disabled={!text.trim() || save.isPending} className="rounded-full bg-navy-deep px-4 py-1.5 text-body-sm font-bold text-white disabled:opacity-50">
          {t('save')}
        </button>
      </span>
    </form>
  );
}

/**
 * The right column of « 2 Après »: « Ses prochaines étapes » (a checklist
 * the Client ticks in her space), « Dans son espace » (what she will see),
 * and « Et ensuite » (open her Dossier).
 */
export function AfterSide({ data, firstName }: { data: Detail; firstName: string }): ReactNode {
  return (
    <>
      <NextSteps data={data} />
      <InTheirSpace data={data} firstName={firstName} />
      <AndThen data={data} firstName={firstName} />
    </>
  );
}

function NextSteps({ data }: { data: Detail }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const trpc = useTRPC();
  const refresh = useAfterMutation(data.id);
  const fieldId = useId();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const done = async (title: string) => {
    await refresh();
    toast.add({ title, type: 'success' });
  };
  const save = useMutation(
    trpc.consultationAdmin.saveNextStep.mutationOptions({
      onSuccess: async () => {
        await done(t('stepSaved'));
        setText('');
        setAdding(false);
        setEditing(null);
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  const remove = useMutation(
    trpc.consultationAdmin.removeNextStep.mutationOptions({
      onSuccess: () => done(t('stepRemoved')),
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  return (
    <section aria-labelledby="next-steps" className={card}>
      <div className="flex flex-col gap-1">
        <h2 id="next-steps" className={cardTitle}>
          {t('steps')}
        </h2>
        <p className="text-body-sm leading-5 text-slate">{t('stepsLead')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {data.nextSteps.map((step) =>
          editing?.id === step.id ? (
            <li key={step.id}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing.text.trim())
                    save.mutate({
                      id: data.id,
                      stepId: step.id,
                      text: editing.text,
                    });
                }}
                className="flex gap-2"
              >
                <label htmlFor={`${fieldId}-${step.id}`} className="sr-only">
                  {t('stepLabel')}
                </label>
                {}
                <input
                  id={`${fieldId}-${step.id}`}
                  autoFocus={true}
                  maxLength={300}
                  value={editing.text}
                  onChange={(e) => setEditing({ id: step.id, text: e.target.value })}
                  className="h-11 flex-1 rounded-xl border-2 border-navy-deep px-3 text-body-sm text-ink outline-none"
                />
                <button type="submit" className="rounded-full bg-navy-deep px-4 text-body-sm font-bold text-white">
                  {t('save')}
                </button>
              </form>
            </li>
          ) : (
            <li key={step.id} className="group flex items-center gap-3 rounded-xl bg-off-white px-3.5 py-3">
              <span aria-hidden={true} className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2', step.doneAt ? 'border-leaf bg-leaf' : 'border-fog bg-white')}>
                {step.doneAt ? <Check className="size-3 text-white" strokeWidth={3.5} /> : null}
              </span>
              <span className={cn('flex-1 text-body-sm text-ink', step.doneAt && 'text-slate line-through')}>{step.text}</span>
              {step.doneAt ? <span className="sr-only">{t('stepDone')}</span> : null}
              <span className="flex shrink-0 gap-1 opacity-60 group-hover:opacity-100">
                <button type="button" onClick={() => setEditing({ id: step.id, text: step.text })} aria-label={t('editStep', { step: step.text })} className="rounded-full p-1.5 hover:bg-white">
                  <Pencil aria-hidden={true} className="size-3.5 text-slate" strokeWidth={2.4} />
                </button>
                <button type="button" onClick={() => remove.mutate({ id: data.id, stepId: step.id })} aria-label={t('removeStep', { step: step.text })} className="rounded-full p-1.5 hover:bg-white">
                  <X aria-hidden={true} className="size-3.5 text-slate" strokeWidth={2.4} />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) save.mutate({ id: data.id, text });
          }}
          className="flex gap-2"
        >
          <label htmlFor={fieldId} className="sr-only">
            {t('stepLabel')}
          </label>
          {}
          <input
            id={fieldId}
            autoFocus={true}
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('stepPlaceholder')}
            className="h-11 flex-1 rounded-xl border-2 border-navy-deep px-3 text-body-sm text-ink outline-none placeholder:text-slate-mute"
          />
          <button type="submit" disabled={!text.trim() || save.isPending} className="rounded-full bg-navy-deep px-4 text-body-sm font-bold text-white disabled:opacity-50">
            {t('add')}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 self-start text-body-sm font-bold text-rouge">
          <Plus aria-hidden={true} className="size-4" strokeWidth={2.6} />
          {t('addStep')}
        </button>
      )}
    </section>
  );
}

function InTheirSpace({ data, firstName }: { data: Detail; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const format = useFormatter();
  const markers = data.clientNotes.filter((n) => n.atSeconds !== null).length;
  const rows: { label: string; value: string; tone?: 'leaf' | 'slate' }[] = [
    {
      label: t('space.video'),
      value: data.recording ? (data.recording.transcript ? t('space.ready') : t('space.videoOnly')) : t('space.none'),
      tone: data.recording ? 'leaf' : 'slate',
    },
    {
      label: t('tabs.notes', { name: firstName }),
      value: data.clientNotes.length ? t('space.notes', { count: data.clientNotes.length, markers }) : '—',
      tone: data.clientNotes.length ? 'leaf' : 'slate',
    },
    {
      label: t('steps'),
      value: data.nextSteps.length ? String(data.nextSteps.length) : '—',
    },
    { label: t('tabs.private'), value: t('space.never'), tone: 'slate' },
  ];
  return (
    <section aria-labelledby="their-space" className={card}>
      <h2 id="their-space" className={cardTitle}>
        {t('space.title')}
      </h2>
      <dl className="flex flex-col gap-2.5 text-body-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-ink">{row.label}</dt>
            <dd className={cn('font-bold', row.tone === 'leaf' ? 'text-leaf' : row.tone === 'slate' ? 'font-normal text-slate' : 'text-ink')}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption leading-4 text-slate">
        {data.publishedAt
          ? t('space.published', {
              date: format.dateTime(new Date(data.publishedAt), {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Douala',
              }),
            })
          : t('space.beforePublish')}
      </p>
    </section>
  );
}

function AndThen({ data, firstName }: { data: Detail; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  return (
    <section aria-labelledby="and-then" className="flex flex-col gap-3 rounded-3xl bg-navy-deep p-6 text-white">
      <p className={cn(LABEL_CLASS, 'text-rose')}>{t('andThen.eyebrow')}</p>
      <h2 id="and-then" className="font-heading text-h4 font-bold">
        {t('andThen.title', { name: firstName })}
      </h2>
      <p className="text-body-sm leading-5 text-white/80">{t('andThen.lead')}</p>
      <Link
        href={`/dossiers/nouveau?account=${data.client.id}`}
        className={cn('mt-1 flex h-12 items-center justify-center rounded-full bg-white font-heading text-body-sm font-bold text-navy-deep', PRESS)}
      >
        {t('andThen.cta')}
      </Link>
    </section>
  );
}

/** « Publier dans son espace » (rouge), or « Publiée » once done; edits after it show without a new e-mail. */
export function PublishButton({ data, firstName }: { data: Detail; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.after');
  const trpc = useTRPC();
  const refresh = useAfterMutation(data.id);
  const publish = useMutation(
    trpc.consultationAdmin.publish.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.add({
          title: t('publishedToast', { name: firstName }),
          type: 'success',
        });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  if (data.publishedAt) {
    return (
      <span className="flex h-11 items-center gap-2 rounded-full bg-leaf-tint px-5 font-heading text-body-sm font-bold text-leaf">
        <Check aria-hidden={true} className="size-4" strokeWidth={3} />
        {t('publishedBadge')}
      </span>
    );
  }
  return (
    <span className="flex flex-1 flex-col items-center gap-1 lg:flex-none">
      <button
        type="button"
        disabled={publish.isPending}
        onClick={() => publish.mutate({ id: data.id })}
        className={cn('h-11 w-full rounded-full bg-rouge px-6 font-heading text-body-sm font-bold text-white hover:bg-crimson disabled:opacity-60', PRESS)}
      >
        {t('publish')}
      </button>
      <span className="text-label text-slate">{t('publishHint')}</span>
    </span>
  );
}
