'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, FileText, Star, Trash2, Upload } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import { DocumentConversation } from '@/features/dossiers/components/document-conversation';
import { useDocumentFocus } from '@/features/dossiers/components/document-focus';
import { DocumentNeeds, NeedBadges } from '@/features/dossiers/components/document-needs';
import {
  CancelSignature,
  RequestSignatureLink,
  SignatureBadge,
  SignedBadge,
  SignLink,
} from '@/features/dossiers/components/document-signature';
import { smallButton, type DocumentData, type Viewer } from '@/features/dossiers/components/document-styles';
import { useDocumentsMutation } from '@/features/dossiers/hooks/use-documents-mutation';
import { DOCUMENT_FILE_TYPES } from '@/features/dossiers/lib/document-schema';
import { withFinal, withoutDocument, type SectionsData } from '@/features/dossiers/lib/documents-cache';
import { uploadVersionFile, versionFileUrl } from '@/features/dossiers/lib/upload-version';
import { isOptimistic } from '@/lib/optimistic-list';
import { useTRPC } from '@/trpc/client';

const ACCEPT = [...DOCUMENT_FILE_TYPES, '.heic', '.heif'].join(',');

/**
 * One Document: its Versions (with the Finale), an upload for the next one
 * and its conversation. Folded until opened, showing the latest Version.
 */
export function DocumentCard({
  dossierId,
  document,
  viewer,
  me,
  open,
  locked,
}: {
  dossierId: string;
  document: DocumentData;
  viewer: Viewer;
  /** The signed-in Account, as the conversation shows its own messages. */
  me: SectionsData['viewer'];
  open: boolean;
  locked: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const format = useFormatter();
  const ids = useId();
  const focus = useDocumentFocus();
  // Opened by a link to this Document (#92).
  const [expanded, setExpanded] = useState(focus.documentId === document.id);
  const [deleting, setDeleting] = useState(false);
  const consultant = viewer === 'consultant';
  // Just added: it has no server id until the refetch, so nothing can be done with it yet.
  const pending = isOptimistic(document);
  const final = document.versions.find((version) => version.id === document.finalVersionId);
  const latest = document.versions.at(-1);
  // The Demande de signature waiting on it (#96), if any.
  const waiting = document.signatures[0];

  return (
    <div className="rounded-xl border border-fog-light">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${ids}-panel`}
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <FileText aria-hidden={true} className="size-5 shrink-0 text-slate" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-navy-deep">{document.title}</span>
            <span className="block truncate text-xs text-slate">
              {t('addedBy', { name: document.addedBy.name })}
              {' · '}
              {latest ? t('versionCount', { count: document.versions.length }) : t('noVersion')}
            </span>
          </span>
          {final ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-leaf-tint px-2.5 py-1 text-xs font-semibold text-leaf">
              <Star aria-hidden={true} className="size-3" />
              {t('finalBadge', { number: final.number })}
            </span>
          ) : null}
          <NeedBadges document={document} />
          <SignatureBadge document={document} viewer={viewer} />
          <ChevronDown
            aria-hidden={true}
            className={expanded ? 'size-4 shrink-0 rotate-180 text-slate' : 'size-4 shrink-0 text-slate'}
          />
        </button>
        {!consultant && open && waiting ? <SignLink dossierId={dossierId} requestId={waiting.id} /> : null}
        {consultant && open && !pending ? (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className={`${smallButton} px-3 text-slate hover:text-rouge`}
          >
            <Trash2 aria-hidden={true} className="size-4" />
            <span className="sr-only">{t('deleteDocument', { title: document.title })}</span>
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div id={`${ids}-panel`} className="grid gap-5 border-t border-fog-light p-4">
          <DocumentNeeds dossierId={dossierId} document={document} viewer={viewer} open={open} />
          <div>
            <h4 className="text-sm font-semibold text-navy-deep">{t('versions')}</h4>
            {document.versions.length === 0 ? (
              <p className="mt-2 text-sm text-slate">{t('noVersionHint')}</p>
            ) : (
              <ol className="mt-2 grid gap-2">
                {[...document.versions].reverse().map((version) => (
                  <li
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-off-white px-3 py-2"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="font-semibold text-navy-deep">V{version.number}</span>{' '}
                      <span className="text-navy-deep">{version.fileName}</span>
                      <span className="block text-xs text-slate">
                        {t('size', { size: format.number(version.size / 1024 / 1024, { maximumFractionDigits: 1 }) })}
                        {' · '}
                        {t('uploadedBy', {
                          name: version.uploadedBy.name,
                          date: format.dateTime(version.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }),
                        })}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {version.signedFor ? <SignedBadge /> : null}
                      {consultant && open && !waiting && version.contentType === 'application/pdf' ? (
                        <RequestSignatureLink dossierId={dossierId} versionId={version.id} number={version.number} />
                      ) : null}
                      {consultant ? (
                        <FinaleToggle
                          dossierId={dossierId}
                          documentId={document.id}
                          versionId={version.id}
                          number={version.number}
                          isFinal={version.id === document.finalVersionId}
                          disabled={!open || locked}
                        />
                      ) : version.id === document.finalVersionId ? (
                        <span className="text-xs font-semibold text-leaf">{t('final')}</span>
                      ) : null}
                      <a
                        href={versionFileUrl(version.id)}
                        target="_blank"
                        rel="noopener"
                        aria-label={t('openVersionLabel', { number: version.number })}
                        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
                      >
                        {t('openVersion')}
                        <ExternalLink aria-hidden={true} className="size-3.5" />
                      </a>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {consultant && open && waiting ? (
              <div className="mt-3">
                <CancelSignature dossierId={dossierId} requestId={waiting.id} />
              </div>
            ) : null}
            {open && !pending ? (
              <UploadVersion dossierId={dossierId} documentId={document.id} title={document.title} />
            ) : null}
          </div>

          <DocumentConversation dossierId={dossierId} document={document} viewer={me} open={open && !pending} />
        </div>
      ) : null}

      {consultant ? (
        <DeleteDocumentDialog dossierId={dossierId} document={document} open={deleting} onOpenChange={setDeleting} />
      ) : null}
    </div>
  );
}

function FinaleToggle({
  dossierId,
  documentId,
  versionId,
  number,
  isFinal,
  disabled,
}: {
  dossierId: string;
  documentId: string;
  versionId: string;
  number: number;
  isFinal: boolean;
  disabled: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const setFinal = useMutation(
    trpc.dossiers.documents.setFinal.mutationOptions(
      optimistic(withFinal, (input) => (input.versionId ? t('toast.finalSet') : t('toast.finalCleared'))),
    ),
  );
  return (
    <button
      type="button"
      aria-pressed={isFinal}
      disabled={disabled}
      onClick={() => setFinal.mutate({ documentId, versionId: isFinal ? null : versionId })}
      className={
        isFinal
          ? 'inline-flex h-9 items-center gap-1 rounded-full bg-leaf-tint px-3 text-xs font-semibold text-leaf disabled:opacity-60'
          : 'inline-flex h-9 items-center gap-1 rounded-full border border-fog-light px-3 text-xs font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50'
      }
    >
      <Star aria-hidden={true} className="size-3" />
      {isFinal ? t('final') : t('markFinal')}
      <span className="sr-only">{t('finalLabel', { number })}</span>
    </button>
  );
}

/** Encrypts the chosen file in the browser, sends it, then records it as the next Version. */
function UploadVersion({
  dossierId,
  documentId,
  title,
}: {
  dossierId: string;
  documentId: string;
  title: string;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const id = useId();
  const trpc = useTRPC();
  const { refresh, failed } = useDocumentsMutation(dossierId);
  const [sending, setSending] = useState(false);
  const addVersion = useMutation(trpc.dossiers.documents.addVersion.mutationOptions());

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSending(true);
    try {
      const uploaded = await uploadVersionFile(documentId, file);
      const { number } = await addVersion.mutateAsync({ documentId, ...uploaded });
      void refresh();
      toast.add({ title: t('toast.versionAdded', { number }), type: 'success' });
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3">
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        aria-label={t('uploadLabel', { title })}
        className="peer sr-only"
        disabled={sending}
        onChange={choose}
      />
      <label
        htmlFor={id}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep peer-disabled:cursor-wait peer-disabled:opacity-50"
      >
        <Upload aria-hidden={true} className="size-4" />
        {sending ? t('uploading') : t('upload')}
      </label>
      <p className="mt-1 text-xs text-slate">{t('uploadHint')}</p>
    </div>
  );
}

function DeleteDocumentDialog({
  dossierId,
  document,
  open,
  onOpenChange,
}: {
  dossierId: string;
  document: DocumentData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const remove = useMutation(
    trpc.dossiers.documents.deleteDocument.mutationOptions(
      optimistic(withoutDocument, () => t('toast.documentDeleted')),
    ),
  );
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('deleteTitle', { title: document.title })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">
            {t('deleteBody', { count: document.versions.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
          <button
            type="button"
            onClick={() => {
              remove.mutate({ id: document.id });
              onOpenChange(false);
            }}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('confirmDelete')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
