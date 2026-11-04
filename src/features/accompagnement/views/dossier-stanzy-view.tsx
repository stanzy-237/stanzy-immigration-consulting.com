'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { HandHelping } from 'lucide-react';
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
import { toast } from '@/components/ui/toast';
import { REASON_MAX } from '@/features/accompagnement/lib/interest-schema';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Request = RouterOutputs['accompagnement']['stanzy']['forDossier'][number];

/**
 * « Documents à obtenir par Stanzy » (#81), for the consultant's Dossier page:
 * the route passes it as the dossiers view's `stanzy` slot. Shows nothing
 * while there is no request.
 */
export function DossierStanzyView({ dossierId }: { dossierId: string }): ReactNode {
  return (
    <QueryBoundary fallback={null}>
      <StanzyRequests dossierId={dossierId} />
    </QueryBoundary>
  );
}

function StanzyRequests({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Accompagnement.stanzy');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: requests } = useSuspenseQuery(trpc.accompagnement.stanzy.forDossier.queryOptions({ dossierId }));
  const [declining, setDeclining] = useState<Request | null>(null);
  if (requests.length === 0) return null;
  return (
    <section id="stanzy" aria-labelledby="dossier-stanzy" className="scroll-mt-24">
      <h2 id="dossier-stanzy" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
        <HandHelping aria-hidden={true} className="size-5" />
        {t('panelTitle')}
      </h2>
      <p className="mt-1 text-sm text-slate">{t('panelIntro')}</p>
      <ul className="mt-4 grid gap-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy-deep">{request.document.title}</span>
                <span className="rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold text-navy-deep">
                  {t(`status.${request.status}`)}
                </span>
              </p>
              <p className="truncate text-sm text-slate">
                {request.document.section.title} ·{' '}
                {format.dateTime(request.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                {request.declineNote ? ` · ${request.declineNote}` : ''}
              </p>
            </div>
            {request.status === 'REQUESTED' ? (
              <button
                type="button"
                onClick={() => setDeclining(request)}
                aria-label={t('declineLabel', { document: request.document.title })}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-rouge hover:bg-off-white"
              >
                {t('decline')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <DeclineDialog dossierId={dossierId} request={declining} onClose={() => setDeclining(null)} />
    </section>
  );
}

function DeclineDialog({
  dossierId,
  request,
  onClose,
}: {
  dossierId: string;
  request: Request | null;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const decline = useMutation(
    trpc.accompagnement.stanzy.decline.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.stanzy.forDossier.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        setNote('');
        toast.add({ title: t('toast.stanzyDeclined'), type: 'success' });
        onClose();
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  return (
    <AlertDialog open={request !== null} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="gap-4 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('stanzy.declineTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('stanzy.declineBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor={`${ids}-note`} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('stanzy.declineNote')}
          <textarea
            id={`${ids}-note`}
            rows={2}
            maxLength={REASON_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('stanzy.keep')}</AlertDialogCancel>
          <button
            type="button"
            disabled={decline.isPending}
            onClick={() => request && decline.mutate({ id: request.id, note: note.trim() })}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('stanzy.declineConfirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
