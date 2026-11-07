'use client';

import { useMutation } from '@tanstack/react-query';
import { CornerDownRight, Pencil, Reply, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDocumentFocus } from '@/features/dossiers/components/document-focus';
import { smallButton, type DocumentData } from '@/features/dossiers/components/document-styles';
import { useDocumentsMutation } from '@/features/dossiers/hooks/use-documents-mutation';
import { COMMENT_MAX, commentInput } from '@/features/dossiers/lib/document-schema';
import {
  editedComment,
  threadsOf,
  withComment,
  withoutComment,
  type SectionsData,
} from '@/features/dossiers/lib/documents-cache';
import { isOptimistic } from '@/lib/optimistic-list';
import { useTRPC } from '@/trpc/client';

type Comment = DocumentData['comments'][number];
type ViewerInfo = SectionsData['viewer'];

const actionClass =
  'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-slate hover:bg-off-white hover:text-navy-deep';

/**
 * A Document's conversation between the Client and the consultant: messages,
 * each with its replies (one level deep). Everyone replies; authors edit
 * their own messages; authors and the consultant delete. Every change shows
 * at once and is put back if the server refuses it.
 */
export function DocumentConversation({
  dossierId,
  document,
  viewer,
  open,
}: {
  dossierId: string;
  document: DocumentData;
  viewer: ViewerInfo;
  open: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.documents.conversation');
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);

  const send = useMutation(
    trpc.dossiers.documents.comment.mutationOptions(
      optimistic(withComment, (input) => (input.parentId ? t('toast.replied') : t('toast.sent'))),
    ),
  );
  const remove = useMutation(
    trpc.dossiers.documents.deleteComment.mutationOptions(optimistic(withoutComment, () => t('toast.deleted'))),
  );
  const threads = threadsOf(document.comments);

  return (
    <div>
      <h4 className="text-sm font-semibold text-navy-deep">{t('title')}</h4>
      {threads.length === 0 ? (
        <p className="mt-2 text-sm text-slate">{t('empty')}</p>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-4">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              <Message
                dossierId={dossierId}
                comment={comment}
                viewer={viewer}
                open={open}
                onReply={() => setReplyingTo(comment.id)}
                onDelete={() => setDeleting(comment)}
              />
              {replies.length > 0 || replyingTo === comment.id ? (
                <ol className="mt-2 ml-4 grid grid-cols-1 gap-2 border-l-2 border-fog-light pl-3 sm:ml-8">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <Message
                        dossierId={dossierId}
                        comment={reply}
                        viewer={viewer}
                        open={open}
                        onReply={() => setReplyingTo(comment.id)}
                        onDelete={() => setDeleting(reply)}
                      />
                    </li>
                  ))}
                  {open && replyingTo === comment.id ? (
                    <li>
                      <Composer
                        label={t('replyLabel', { name: comment.deletedAt ? t('deleted') : comment.author.name })}
                        placeholder={t('replyPlaceholder')}
                        submitLabel={t('reply')}
                        autoFocus
                        onCancel={() => setReplyingTo(null)}
                        onSubmit={(body) => {
                          send.mutate({ documentId: document.id, parentId: comment.id, body });
                          setReplyingTo(null);
                        }}
                      />
                    </li>
                  ) : null}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {open ? (
        <div className="mt-4">
          <Composer
            label={t('label', { title: document.title })}
            placeholder={t('placeholder')}
            submitLabel={t('send')}
            onSubmit={(body) => send.mutate({ documentId: document.id, body })}
          />
        </div>
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">
              {deleting && document.comments.some((comment) => comment.parentId === deleting.id)
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
    </div>
  );
}

/** One message: who wrote it and when, its words (or « Message supprimé »), and what the viewer may do with it. */
function Message({
  dossierId,
  comment,
  viewer,
  open,
  onReply,
  onDelete,
}: {
  dossierId: string;
  comment: Comment;
  viewer: ViewerInfo;
  open: boolean;
  onReply: () => void;
  onDelete: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.documents.conversation');
  const format = useFormatter();
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const [editing, setEditing] = useState(false);
  const edit = useMutation(
    trpc.dossiers.documents.editComment.mutationOptions(optimistic(editedComment, () => t('toast.edited'))),
  );

  const mine = comment.author.id === viewer.id;
  const pending = isOptimistic(comment);
  // The message a link pointed to (#92): brought into view and outlined.
  const focused = useDocumentFocus().messageId === comment.id;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' });
  }, [focused]);
  const canAct = open && !pending && !comment.deletedAt;
  const isReply = comment.parentId !== null;

  if (comment.deletedAt) {
    return (
      <div className="rounded-xl border border-dashed border-fog-light px-3 py-2 text-sm italic text-slate-mute">
        {t('deleted')}
      </div>
    );
  }

  return (
    <article
      ref={ref}
      id={`message-${comment.id}`}
      aria-busy={pending}
      aria-current={focused ? 'true' : undefined}
      className={`rounded-xl px-3 py-2 ${mine ? 'bg-ice-blue' : 'bg-off-white'} ${focused ? 'ring-2 ring-rouge' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-x-2 text-xs text-slate">
        {isReply ? <CornerDownRight aria-hidden={true} className="size-3" /> : null}
        <span className="font-semibold text-navy-deep">{mine ? t('you') : comment.author.name}</span>
        {comment.author.role === 'CONSULTANT' ? (
          <span className="rounded-full bg-navy-deep px-1.5 py-px text-xs font-semibold text-white">Stanzy</span>
        ) : null}
        <time dateTime={new Date(comment.createdAt).toISOString()}>
          {format.dateTime(comment.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </time>
        {comment.editedAt ? <span>· {t('edited')}</span> : null}
        {pending ? <span>· {t('sending')}</span> : null}
      </header>

      {editing ? (
        <div className="mt-2">
          <Composer
            label={t('editLabel')}
            initial={comment.body}
            submitLabel={t('save')}
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={(body) => {
              if (body !== comment.body) edit.mutate({ id: comment.id, body });
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-line text-sm text-navy-deep">{comment.body}</p>
      )}

      {canAct && !editing ? (
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

/**
 * Where a message is written: a new one, a reply, or an edit. Sends on the
 * button or Ctrl/⌘ + Entrée; Échap cancels. Clears at once: the message is
 * already on screen.
 */
function Composer({
  label,
  placeholder,
  initial = '',
  submitLabel,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  initial?: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.documents.conversation');
  const id = useId();
  const [body, setBody] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const valid = commentInput.shape.body.safeParse(body);
    setInvalid(!valid.success);
    if (!valid.success) return;
    onSubmit(valid.data);
    setBody('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
    if (event.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        value={body}
        maxLength={COMMENT_MAX}
        placeholder={placeholder}
        // The composer opens on « Répondre » / « Modifier »: the person is about to type.
        autoFocus={autoFocus}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        className="rounded-xl border-2 border-fog-light bg-white px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
      />
      {invalid ? (
        <p id={`${id}-error`} className="text-sm text-rouge">
          {t('error')}
        </p>
      ) : null}
      <div className="flex justify-end gap-1">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={`${smallButton} text-slate hover:text-navy-deep`}>
            {t('cancel')}
          </button>
        ) : null}
        <button type="submit" className={`${smallButton} bg-navy-deep text-white hover:bg-navy-80`}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
