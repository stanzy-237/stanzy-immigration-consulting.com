'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { FileSignature, FileStack, HandHelping } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: its short paths, outside next-intl's routing.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { TermsDialog } from '@/features/document-services/components/terms-dialog';
import { PERCENT_MAX, prerequisitesOf, textIn } from '@/features/document-services/lib/service-schema';
import { formatMoney } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Request = RouterOutputs['accompagnement']['stanzy']['forDossier'][number];

/**
 * « Documents à obtenir par Stanzy » (#81), for the consultant's Dossier page:
 * the route passes it as the dossiers view's `stanzy` slot. Each request
 * shows its Service documentaire and price (#80); taking it on sends that
 * service's own Contrat and puts a line on the draft invoice. Shows nothing
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
  const locale = useLocale();
  const [declining, setDeclining] = useState<Request | null>(null);
  const [accepting, setAccepting] = useState<Request | null>(null);
  if (requests.length === 0) return null;
  return (
    <section id="stanzy" aria-labelledby="dossier-stanzy" className="scroll-mt-24">
      <h2 id="dossier-stanzy" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
        <HandHelping aria-hidden={true} className="size-5" />
        {t('panelTitle')}
      </h2>
      <p className="mt-1 text-sm text-slate">{t('panelIntro')}</p>
      <ul className="mt-4 grid grid-cols-1 gap-2">
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
              <p className="mt-1 text-sm text-navy-deep">
                {request.service ? (
                  <>
                    <span className="font-semibold">{textIn(request.service.name, locale)}</span>
                    {' · '}
                    {request.service.priceKind === 'FIXED'
                      ? formatMoney(request.service.price, 'XAF', locale)
                      : format.number(request.service.price / PERCENT_MAX, { style: 'percent', maximumFractionDigits: 2 })}{' '}
                    {textIn(request.service.unit, locale)}
                    {request.acceptedAt ? ` · ${t('conditionsAccepted')}` : ''}
                  </>
                ) : (
                  <span className="text-honey">{t('noService')}</span>
                )}
              </p>
              {request.contract ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate">
                  <FileSignature aria-hidden={true} className="size-3.5" />
                  {t('contract', { number: request.contract.number, status: request.contract.status })}
                </p>
              ) : null}
              {request.service && (request.service.questionnaire || prerequisitesOf(request.service.prerequisites).length > 0) ? (
                <Link
                  href={`/dossiers/${dossierId}/services/${request.id}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-rouge hover:text-crimson"
                >
                  <FileStack aria-hidden={true} className="size-4" />
                  {t('requirements', { count: request._count.files })}
                </Link>
              ) : null}
            </div>
            {request.status === 'REQUESTED' ? (
              <div className="flex flex-wrap items-center gap-1">
                {request.service ? (
                  <button
                    type="button"
                    onClick={() => setAccepting(request)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
                  >
                    <FileSignature aria-hidden={true} className="size-4" />
                    {t('accept')}
                  </button>
                ) : (
                  <ServicePicker dossierId={dossierId} request={request} />
                )}
                <button
                  type="button"
                  onClick={() => setDeclining(request)}
                  aria-label={t('declineLabel', { document: request.document.title })}
                  className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-rouge hover:bg-off-white"
                >
                  {t('decline')}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <DeclineDialog dossierId={dossierId} request={declining} onClose={() => setDeclining(null)} />
      {accepting ? <AcceptDialog dossierId={dossierId} request={accepting} onClose={() => setAccepting(null)} /> : null}
    </section>
  );
}

/** For a request with no Service documentaire yet: the consultant picks the one that gets it. */
function ServicePicker({ dossierId, request }: { dossierId: string; request: Request }): ReactNode {
  const t = useTranslations('Accompagnement');
  const locale = useLocale();
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: services = [] } = useQuery(trpc.documentServices.dashboard.list.queryOptions());
  const set = useMutation(
    trpc.accompagnement.stanzy.setService.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.stanzy.forDossier.queryKey({ dossierId }) }),
      onError: () => toast.add({ title: t('errors.UNKNOWN'), type: 'error' }),
    }),
  );
  return (
    <label htmlFor={`${id}-service`} className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
      <span className="sr-only">{t('stanzy.pickService', { document: request.document.title })}</span>
      <select
        id={`${id}-service`}
        value=""
        disabled={set.isPending || services.length === 0}
        onChange={(event) => event.target.value && set.mutate({ id: request.id, serviceId: event.target.value })}
        className="h-10 rounded-full border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
      >
        <option value="">{t('stanzy.chooseService')}</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {textIn(service.name, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Taking a request on: the service's own Contrat to the Client, and the same amount on the draft invoice. */
function AcceptDialog({ dossierId, request, onClose }: { dossierId: string; request: Request; onClose: () => void }): ReactNode {
  const t = useTranslations('Accompagnement.stanzy');
  const errors = useTranslations('Accompagnement.errors');
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const service = request.service!;
  const accept = useMutation(
    trpc.accompagnement.stanzy.accept.mutationOptions({
      onSuccess: ({ contract, invoiceId }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.stanzy.forDossier.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.contracts.forDossier.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.invoices.forDossier.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        toast.add({
          title: t('accepted', { number: contract.number }),
          type: 'success',
          actionProps: { children: t('openInvoice'), onClick: () => router.push(`/factures/${invoiceId}`) },
        });
        onClose();
      },
      onError: (error) => {
        const known = errors.has(error.message);
        toast.add({ title: errors(known ? error.message : 'UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  return (
    <TermsDialog
      service={service}
      description={(lang) => t('acceptBody', { service: textIn(service.name, lang), document: request.document.title })}
      pending={accept.isPending}
      onSubmit={(terms) => accept.mutate({ id: request.id, ...terms })}
      onClose={onClose}
    />
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
        <label htmlFor={`${ids}-note`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
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
