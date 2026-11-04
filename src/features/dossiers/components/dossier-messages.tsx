'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CornerDownRight, Paperclip, Pencil, Reply, Trash2, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

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
import { toast } from '@/components/ui/toast';
import { smallButton, type Viewer } from '@/features/dossiers/components/document-styles';
import { COMMENT_MAX, DOCUMENT_FILE_TYPES } from '@/features/dossiers/lib/document-schema';
import { threadsOf } from '@/features/dossiers/lib/documents-cache';
import { MESSAGE_FILES_MAX, messageFileUrl } from '@/features/dossiers/lib/message-schema';
import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Conversation = RouterOutputs['dossiers']['messages']['list'];
type Message = Conversation['messages'][number];

const ACCEPT = [...DOCUMENT_FILE_TYPES, '.heic', '.heif'].join(',');
const actionClass =
  'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-slate hover:bg-off-white hover:text-navy-deep';

const ERRORS = [
  'MESSAGE_EMPTY',
  'COMMENT_NOT_YOURS',
  'DOSSIER_CLOSED',
  'DOCUMENT_FILE_TYPE',
  'DOCUMENT_FILE_TOO_LARGE',
  'DOCUMENT_FILE_INVALID',
  'DOSSIER_FILES_UNCONFIGURED',
];

/** Re-reads the conversation, and toasts why something was refused. */
function useMessages(dossierId: string) {
  const t = useTranslations('Dossiers.messages');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.dossiers.messages.list.queryKey({ dossierId }) });
  const failed = (error: { message: string }) => {
    const reason = ERRORS.includes(error.message) ? error.message : 'UNKNOWN';
    refresh();
    toast.add({ title: t(`errors.${reason}` as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
  return { refresh, failed };
}

/**
 * A Dossier's « Messages » (#94): the general conversation between its Client
 * and the consultant, apart from the Documents'. Replies one level deep,
 * files attached and encrypted in the browser; read only once closed.
 */
export function DossierMessages({ dossierId, viewer }: { dossierId: string; viewer: Viewer }): ReactNode {
  const t = useTranslations('Dossiers.messages');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.dossiers.messages.list.queryOptions({ dossierId }));
  const { refresh, failed } = useMessages(dossierId);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const remove = useMutation(
    trpc.dossiers.messages.delete.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.deleted'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const threads = threadsOf(data.messages);

  return (
    <section id="messages" aria-labelledby="dossier-messages" className="scroll-mt-24">
      <h2 id="dossier-messages" className="font-heading text-xl font-bold text-navy-deep">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-slate">{viewer === 'client' ? t('introClient') : t('introConsultant')}</p>
      <div className="mt-4 rounded-2xl border border-fog-light bg-white p-4 shadow-sm sm:p-5">
        {threads.length === 0 ? (
          <p className="text-sm text-slate">{t('empty')}</p>
        ) : (
          <ol className="grid gap-4">
            {threads.map(({ comment, replies }) => (
              <li key={comment.id}>
                <MessageItem
                  dossierId={dossierId}
                  message={comment}
                  viewer={data.viewer}
                  open={data.open}
                  onReply={() => setReplyingTo(comment.id)}
                  onDelete={() => setDeleting(comment)}
                />
                {replies.length > 0 || replyingTo === comment.id ? (
                  <ol className="mt-2 ml-4 grid gap-2 border-l-2 border-fog-light pl-3 sm:ml-8">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <MessageItem
                          dossierId={dossierId}
                          message={reply}
                          viewer={data.viewer}
                          open={data.open}
                          onReply={() => setReplyingTo(comment.id)}
                          onDelete={() => setDeleting(reply)}
                        />
                      </li>
                    ))}
                    {data.open && replyingTo === comment.id ? (
                      <li>
                        <Composer
                          dossierId={dossierId}
                          parentId={comment.id}
                          label={t('replyLabel', { name: comment.deletedAt ? t('deleted') : comment.author.name })}
                          placeholder={t('replyPlaceholder')}
                          submitLabel={t('reply')}
                          onDone={() => setReplyingTo(null)}
                        />
                      </li>
                    ) : null}
                  </ol>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 border-t border-fog-light pt-4">
          {data.open ? (
            <Composer dossierId={dossierId} label={t('label')} placeholder={t('placeholder')} submitLabel={t('send')} />
          ) : (
            <p className="text-sm text-slate">{t('closed')}</p>
          )}
        </div>
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">
              {deleting && data.messages.some((message) => message.parentId === deleting.id)
                ? t('deleteBodyWithReplies')
                : t('deleteBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                if (deleting) remove.mutate({ id: deleting.id });
                setDeleting(null);
              }}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson"
            >
              {t('delete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** One message: who wrote it and when, its words and files (or « Message supprimé »), and what the viewer may do. */
function MessageItem({
  dossierId,
  message,
  viewer,
  open,
  onReply,
  onDelete,
}: {
  dossierId: string;
  message: Message;
  viewer: Conversation['viewer'];
  open: boolean;
  onReply: () => void;
  onDelete: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.messages');
  const format = useFormatter();
  const trpc = useTRPC();
  const { refresh, failed } = useMessages(dossierId);
  const [editing, setEditing] = useState(false);
  const edit = useMutation(
    trpc.dossiers.messages.edit.mutationOptions({
      onSuccess: () => {
        refresh();
        setEditing(false);
        toast.add({ title: t('toast.edited'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const mine = message.author.id === viewer.id;

  if (message.deletedAt) {
    return (
      <div className="rounded-xl border border-dashed border-fog-light px-3 py-2 text-sm text-slate-mute italic">
        {t('deleted')}
      </div>
    );
  }
  return (
    <article id={`message-${message.id}`} className={`rounded-xl px-3 py-2 ${mine ? 'bg-ice-blue' : 'bg-off-white'}`}>
      <header className="flex flex-wrap items-center gap-x-2 text-xs text-slate">
        {message.parentId ? <CornerDownRight aria-hidden={true} className="size-3" /> : null}
        <span className="font-semibold text-navy-deep">{mine ? t('you') : message.author.name}</span>
        {message.author.role === 'CONSULTANT' ? (
          <span className="rounded-full bg-navy-deep px-1.5 py-px text-xs font-semibold text-white">Stanzy</span>
        ) : null}
        <time dateTime={new Date(message.createdAt).toISOString()}>
          {format.dateTime(message.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </time>
        {message.editedAt ? <span>· {t('edited')}</span> : null}
      </header>

      {editing ? (
        <EditForm
          initial={message.body}
          allowEmpty={message.files.length > 0}
          pending={edit.isPending}
          onCancel={() => setEditing(false)}
          onSave={(body) => (body === message.body ? setEditing(false) : edit.mutate({ id: message.id, body }))}
        />
      ) : message.body ? (
        <p className="mt-1 text-sm whitespace-pre-line text-navy-deep">{message.body}</p>
      ) : null}

      {message.files.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {message.files.map((file) => (
            <li key={file.id}>
              <a
                href={messageFileUrl(file.id)}
                target="_blank"
                rel="noopener"
                aria-label={t('openFile', { name: file.fileName })}
                className="inline-flex h-8 max-w-64 items-center gap-1.5 rounded-full border border-fog-light bg-white px-3 text-xs font-semibold text-navy-deep hover:border-navy-deep"
              >
                <Paperclip aria-hidden={true} className="size-3.5 shrink-0" />
                <span className="truncate">{file.fileName}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !editing ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <button type="button" onClick={onReply} className={actionClass}>
            <Reply aria-hidden={true} className="size-3.5" />
            {t('reply')}
          </button>
          {mine ? (
            <button type="button" onClick={() => setEditing(true)} className={actionClass}>
              <Pencil aria-hidden={true} className="size-3.5" />
              {t('edit')}
            </button>
          ) : null}
          {mine || viewer.role === 'CONSULTANT' ? (
            <button type="button" onClick={onDelete} className={actionClass}>
              <Trash2 aria-hidden={true} className="size-3.5" />
              {t('delete')}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EditForm({
  initial,
  allowEmpty,
  pending,
  onSave,
  onCancel,
}: {
  initial: string;
  allowEmpty: boolean;
  pending: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.messages');
  const id = useId();
  const [body, setBody] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const words = body.trim();
    setInvalid(!words && !allowEmpty);
    if (words || allowEmpty) onSave(words);
  };
  return (
    <form onSubmit={submit} noValidate className="mt-2 grid gap-1.5">
      <label htmlFor={id} className="sr-only">
        {t('editLabel')}
      </label>
      <textarea
        id={id}
        rows={2}
        value={body}
        maxLength={COMMENT_MAX}
        // Opened on « Modifier »: the person is about to type.
        autoFocus={true}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
          if (event.key === 'Escape') onCancel();
        }}
        className="rounded-xl border-2 border-fog-light bg-white px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
      />
      {invalid ? (
        <p id={`${id}-error`} className="text-sm text-rouge">
          {t('error')}
        </p>
      ) : null}
      <div className="flex justify-end gap-1">
        <button type="button" onClick={onCancel} className={`${smallButton} text-slate hover:text-navy-deep`}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={pending} className={`${smallButton} bg-navy-deep text-white hover:bg-navy-80`}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}

/**
 * Where a message or a reply is written, with files to attach. Sends on the
 * button or Ctrl/⌘ + Entrée; Échap cancels a reply. The files are encrypted
 * and stored first, then the message is posted.
 */
function Composer({
  dossierId,
  parentId,
  label,
  placeholder,
  submitLabel,
  onDone,
}: {
  dossierId: string;
  parentId?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  /** A reply's composer closes once sent or cancelled. */
  onDone?: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.messages');
  const id = useId();
  const trpc = useTRPC();
  const { refresh, failed } = useMessages(dossierId);
  const picker = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [invalid, setInvalid] = useState<'empty' | 'tooMany' | null>(null);
  const post = useMutation(
    trpc.dossiers.messages.post.mutationOptions({
      onSuccess: () => {
        refresh();
        setBody('');
        setFiles([]);
        toast.add({ title: parentId ? t('toast.replied') : t('toast.sent'), type: 'success' });
        onDone?.();
      },
      onError: failed,
    }),
  );
  const pending = uploading || post.isPending;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (pending) return;
    const words = body.trim();
    if (!words && files.length === 0) return setInvalid('empty');
    setInvalid(null);
    setUploading(true);
    try {
      const stored = await Promise.all(
        files.map((file) => uploadEncryptedFile(file, { uploadRoute: '/api/dossiers/messages/upload', payload: { dossierId } })),
      );
      post.mutate({ dossierId, parentId, body: words, files: stored });
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setUploading(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
    if (event.key === 'Escape' && onDone) onDone();
  };
  const add = (picked: FileList | null) => {
    const next = [...files, ...Array.from(picked ?? [])];
    setInvalid(next.length > MESSAGE_FILES_MAX ? 'tooMany' : null);
    setFiles(next.slice(0, MESSAGE_FILES_MAX));
    if (picker.current) picker.current.value = '';
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        value={body}
        maxLength={COMMENT_MAX}
        placeholder={placeholder}
        // A reply's composer opens on « Répondre »: the person is about to type.
        autoFocus={Boolean(parentId)}
        aria-invalid={invalid === 'empty'}
        aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        className="rounded-xl border-2 border-fog-light bg-white px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
      />
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex h-8 max-w-64 items-center gap-1 rounded-full bg-off-white pr-1 pl-3 text-xs font-semibold text-navy-deep"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, at) => at !== index))}
                aria-label={t('removeFile', { name: file.name })}
                className="inline-flex size-6 items-center justify-center rounded-full hover:bg-fog-light"
              >
                <X aria-hidden={true} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {invalid ? (
        <p id={`${id}-error`} className="text-sm text-rouge">
          {invalid === 'empty' ? t('error') : t('tooMany', { max: MESSAGE_FILES_MAX })}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-slate">
          {t('attachHint', { max: MESSAGE_FILES_MAX })}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label
          htmlFor={`${id}-files`}
          className={`${smallButton} cursor-pointer text-navy-deep hover:bg-off-white has-focus-visible:ring-2 has-focus-visible:ring-navy-deep`}
        >
          <Paperclip aria-hidden={true} className="size-4" />
          {t('attach')}
          <input
            ref={picker}
            id={`${id}-files`}
            type="file"
            multiple={true}
            accept={ACCEPT}
            disabled={files.length >= MESSAGE_FILES_MAX}
            onChange={(event) => add(event.target.files)}
            className="sr-only"
          />
        </label>
        <div className="flex gap-1">
          {onDone ? (
            <button type="button" onClick={onDone} className={`${smallButton} text-slate hover:text-navy-deep`}>
              {t('cancel')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className={`${smallButton} bg-navy-deep text-white hover:bg-navy-80`}
          >
            {pending ? t('sending') : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DossierMessagesSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.messages');
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-7 w-40 rounded-lg" />
      <Skeleton aria-hidden={true} className="h-48 rounded-2xl" />
    </div>
  );
}
