'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
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
import { toast } from '@/components/ui/toast';
import { COMMENT_MAX } from '@/features/dossiers/lib/document-schema';
import { versionFileUrl } from '@/features/dossiers/lib/upload-version';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { PdfPagesSkeleton } from '@/features/shared/components/signing/pdf-pages';
import { SigningFlow } from '@/features/shared/components/signing/signing-flow';
import { useSignatureErrors } from '@/features/signatures/hooks/use-signature-errors';
import { Link, useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * The Client signs a document in « Mon espace » (#96), as in Documenso: the
 * email's button opens it here; they click each framed field on the page —
 * a Signature opens a dialog to draw it (black or blue ink), the Nom complet
 * asks their name, the Date fills in — then « Terminer » asks them to
 * confirm they read and accept it. Or they ask for a change, which goes to
 * the Document's conversation.
 */
export function SignView({ dossierId, requestId }: { dossierId: string; requestId: string }): ReactNode {
  const t = useTranslations('Signatures.sign');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid grid-cols-1 max-w-3xl gap-8">
          <Link
            href={`/mon-espace/dossiers/${dossierId}`}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
          >
            <ArrowLeft aria-hidden={true} className="size-4" />
            {t('back')}
          </Link>
          <QueryBoundary fallback={<SignSkeleton />}>
            <SignRequest dossierId={dossierId} requestId={requestId} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SignRequest({ dossierId, requestId }: { dossierId: string; requestId: string }): ReactNode {
  const t = useTranslations('Signatures');
  const format = useFormatter();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const failed = useSignatureErrors();
  const { data: request } = useSuspenseQuery(trpc.signatures.get.queryOptions({ id: requestId }));
  const [asking, setAsking] = useState(false);
  const documentHref = `/mon-espace/dossiers/${dossierId}?document=${request.document.id}#documents`;

  const sign = useMutation(
    trpc.signatures.sign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.signatures.get.queryKey({ id: requestId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        toast.add({ title: t('sign.signed'), type: 'success' });
        router.push(documentHref);
      },
      onError: failed,
    }),
  );

  const heading = (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">
        {t('sign.title', { document: request.document.title })}
      </h1>
      <p className="mt-1 text-sm text-slate">{request.document.section}</p>
    </div>
  );

  if (!request.canSign) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {heading}
        <p className="flex items-start gap-2 rounded-2xl border border-fog-light bg-white p-5 text-sm text-navy-deep shadow-sm">
          <CheckCircle2 aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-leaf" />
          {request.status === 'SIGNED' && request.signedAt
            ? t('sign.alreadySigned', {
                date: format.dateTime(request.signedAt, { day: 'numeric', month: 'long', year: 'numeric' }),
              })
            : t('sign.notWaiting')}
        </p>
        <Link
          href={documentHref}
          className="inline-flex h-11 w-fit items-center rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80"
        >
          {t('sign.openSigned')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 pb-24">
      {heading}
      <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('sign.intro')}</p>
      <SigningFlow
        url={versionFileUrl(request.versionId)}
        fields={request.fields}
        document={request.document.title}
        signerName={request.signerName}
        pending={sign.isPending}
        onSign={({ name, signature }) => sign.mutate({ id: request.id, name, signature, accepted: true })}
        actions={
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
          >
            <MessageSquareWarning aria-hidden={true} className="size-4" />
            {t('sign.change.open')}
          </button>
        }
      />
      <AskChange
        open={asking}
        onOpenChange={setAsking}
        documentId={request.document.id}
        onSent={() => router.push(documentHref)}
      />
    </div>
  );
}

/** « Demander une modification »: a message in the Document's conversation, for the consultant to correct. */
function AskChange({
  open,
  onOpenChange,
  documentId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onSent: () => void;
}): ReactNode {
  const t = useTranslations('Signatures.sign.change');
  const id = useId();
  const trpc = useTRPC();
  const failed = useSignatureErrors();
  const [message, setMessage] = useState('');
  const comment = useMutation(
    trpc.dossiers.documents.comment.mutationOptions({
      onSuccess: () => {
        toast.add({ title: t('sent'), type: 'success' });
        onOpenChange(false);
        onSent();
      },
      onError: failed,
    }),
  );
  const body = t('prefix', { message: message.trim() });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor={id} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('label')}
          <textarea
            id={id}
            rows={4}
            value={message}
            maxLength={COMMENT_MAX - 80}
            onChange={(event) => setMessage(event.target.value)}
            className="rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
          <button
            type="button"
            disabled={message.trim().length === 0 || comment.isPending}
            onClick={() => comment.mutate({ documentId, body })}
            className="rounded-full bg-navy-deep px-5 py-2 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
          >
            {t('send')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SignSkeleton(): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton aria-hidden={true} className="h-10 w-2/3" />
      <PdfPagesSkeleton />
    </div>
  );
}
