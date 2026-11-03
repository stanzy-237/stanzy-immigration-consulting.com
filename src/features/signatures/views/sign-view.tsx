'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MessageSquareWarning, PenLine } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

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
import { FIELD_COLORS } from '@/features/signatures/components/field-placer';
import { fieldStyle, PdfPages, PdfPagesSkeleton } from '@/features/signatures/components/pdf-pages';
import { SignaturePad } from '@/features/signatures/components/signature-pad';
import { useSignatureErrors } from '@/features/signatures/hooks/use-signature-errors';
import { NAME_MAX } from '@/features/signatures/lib/signature-schema';
import { Link, useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * The Client signs a document in « Mon espace » (#96): they read it, with
 * the places to be filled framed, tick « J'ai lu et j'accepte », type their
 * full name and draw their signature. Or they ask for a change, which goes
 * to the Document's conversation.
 */
export function SignView({ dossierId, requestId }: { dossierId: string; requestId: string }): ReactNode {
  const t = useTranslations('Signatures.sign');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-3xl gap-8">
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
  const ids = useId();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const failed = useSignatureErrors();
  const { data: request } = useSuspenseQuery(trpc.signatures.get.queryOptions({ id: requestId }));
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [problem, setProblem] = useState<'accept' | 'signature' | null>(null);
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!accepted) return setProblem('accept');
    if (!signature) return setProblem('signature');
    setProblem(null);
    sign.mutate({ id: request.id, name: name.trim(), signature, accepted: true });
  };

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
      <div className="grid gap-4">
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
    <div className="grid gap-6">
      {heading}
      <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('sign.intro')}</p>

      <PdfPages
        url={versionFileUrl(request.versionId)}
        overlay={(page) =>
          request.fields
            .filter((field) => field.page === page)
            .map((field, index) => (
              <span
                key={index}
                className={`absolute flex items-center justify-center rounded-md border-2 border-dashed text-xs font-semibold ${FIELD_COLORS[field.kind]}`}
                style={fieldStyle(field)}
              >
                <span className="truncate px-1">{t('sign.fieldHere', { field: t(`fields.${field.kind}`) })}</span>
              </span>
            ))
        }
      />

      <form
        onSubmit={submit}
        noValidate={true}
        className="grid gap-5 rounded-2xl border border-fog-light bg-white p-5 shadow-sm"
      >
        <label className="flex items-start gap-3 text-sm text-navy-deep">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            aria-invalid={problem === 'accept'}
            aria-describedby={problem === 'accept' ? `${ids}-problem` : undefined}
            className="mt-0.5 size-5 shrink-0 accent-rouge"
          />
          {t('sign.accept')}
        </label>

        <div className="grid gap-1">
          <label htmlFor={`${ids}-name`} className="text-sm font-semibold text-navy-deep">
            {t('sign.name')}
          </label>
          <input
            id={`${ids}-name`}
            value={name}
            required={true}
            minLength={3}
            maxLength={NAME_MAX}
            autoComplete="name"
            aria-describedby={`${ids}-name-hint`}
            onChange={(event) => setName(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
          />
          <p id={`${ids}-name-hint`} className="text-xs text-slate">
            {t('sign.nameHint')}
          </p>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-semibold text-navy-deep">{t('sign.pad')}</p>
          <p id={`${ids}-pad-hint`} className="text-xs text-slate">
            {t('sign.padHint')}
          </p>
          <SignaturePad onChange={setSignature} describedBy={`${ids}-pad-hint`} />
        </div>

        {problem ? (
          <p id={`${ids}-problem`} role="alert" className="text-sm font-semibold text-crimson">
            {problem === 'accept' ? t('sign.needAccept') : t('sign.needSignature')}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
          >
            <MessageSquareWarning aria-hidden={true} className="size-4" />
            {t('sign.change.open')}
          </button>
          <button
            type="submit"
            disabled={sign.isPending || name.trim().length < 3}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            <PenLine aria-hidden={true} className="size-4" />
            {sign.isPending ? t('sign.signing') : t('sign.submit')}
          </button>
        </div>
      </form>

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
        <label htmlFor={id} className="grid gap-1 text-sm font-semibold text-navy-deep">
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
    <div className="grid gap-6">
      <Skeleton aria-hidden={true} className="h-10 w-2/3" />
      <PdfPagesSkeleton />
    </div>
  );
}
