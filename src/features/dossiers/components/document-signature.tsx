'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, PenLine, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useState, type ReactNode } from 'react';

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
import type { DocumentData, Viewer } from '@/features/dossiers/components/document-styles';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * A Document's Demande de signature (#96), as its card shows it: « À signer »
 * and « Signer » for the Client, « Signature en attente » and « Annuler la
 * demande » for the consultant.
 */
export function SignatureBadge({ document, viewer }: { document: DocumentData; viewer: Viewer }): ReactNode {
  const t = useTranslations('Signatures.card');
  if (document.signatures.length === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-crimson">
      <PenLine aria-hidden={true} className="size-3" />
      {viewer === 'client' ? t('pendingClient') : t('pendingConsultant')}
    </span>
  );
}

/** The Client's way to the signing page. */
export function SignLink({ dossierId, requestId }: { dossierId: string; requestId: string }): ReactNode {
  const t = useTranslations('Signatures.card');
  return (
    <Link
      href={`/mon-espace/dossiers/${dossierId}/signer/${requestId}`}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson"
    >
      <PenLine aria-hidden={true} className="size-4" />
      {t('sign')}
    </Link>
  );
}

/** « Faire signer » on a PDF Version, for the consultant. */
export function RequestSignatureLink({
  dossierId,
  versionId,
  number,
}: {
  dossierId: string;
  versionId: string;
  number: number;
}): ReactNode {
  const t = useTranslations('Signatures.card');
  return (
    <NextLink
      href={`/dossiers/${dossierId}/signature?version=${versionId}`}
      aria-label={t('requestLabel', { number })}
      className="inline-flex h-9 items-center gap-1 rounded-full border border-fog-light px-3 text-xs font-semibold text-navy-deep hover:border-navy-deep"
    >
      <PenLine aria-hidden={true} className="size-3" />
      {t('request')}
    </NextLink>
  );
}

/** « Demander une signature » on a PDF still to choose or upload, above the Sections. */
export function NewSignatureLink({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Signatures.card');
  return (
    <NextLink
      href={`/dossiers/${dossierId}/signature`}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
    >
      <PenLine aria-hidden={true} className="size-4" />
      {t('newRequest')}
    </NextLink>
  );
}

/** Marks a Version that is the signed PDF of a Demande. */
export function SignedBadge(): ReactNode {
  const t = useTranslations('Signatures.card');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-leaf-tint px-2.5 py-1 text-xs font-semibold text-leaf">
      <BadgeCheck aria-hidden={true} className="size-3" />
      {t('signedBadge')}
    </span>
  );
}

/** The consultant withdraws the Demande waiting on a Document. */
export function CancelSignature({ dossierId, requestId }: { dossierId: string; requestId: string }): ReactNode {
  const t = useTranslations('Signatures.card');
  const errors = useTranslations('Signatures.errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const cancel = useMutation(
    trpc.signatures.cancel.mutationOptions({
      onSuccess: () => toast.add({ title: t('cancelled'), type: 'deleted' }),
      onError: () => toast.add({ title: errors('UNKNOWN'), type: 'error' }),
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.signatures.pending.queryKey() });
      },
    }),
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate hover:text-rouge"
      >
        <XCircle aria-hidden={true} className="size-4" />
        {t('cancel')}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('cancelBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('keep')}</AlertDialogCancel>
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => {
                cancel.mutate({ id: requestId });
                setOpen(false);
              }}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {t('confirmCancel')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Above the Sections, for the Client: the documents waiting for their signature. */
export function SignatureAlert({
  dossierId,
  documents,
}: {
  dossierId: string;
  documents: DocumentData[];
}): ReactNode {
  const t = useTranslations('Signatures.card');
  const waiting = documents.filter((document) => document.signatures.length > 0);
  if (waiting.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-rouge/30 bg-blush/40 p-4">
      <p className="flex items-center gap-2 font-semibold text-navy-deep">
        <PenLine aria-hidden={true} className="size-5 text-rouge" />
        {t('alert', { count: waiting.length })}
      </p>
      <ul className="grid grid-cols-1 gap-2">
        {waiting.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 truncate text-sm font-semibold text-navy-deep">{document.title}</span>
            <SignLink dossierId={dossierId} requestId={document.signatures[0]!.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
