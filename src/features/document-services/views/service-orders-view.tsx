'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { FileSignature } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { REASON_MAX } from '@/features/accompagnement/lib/interest-schema';
import { STATUS_STYLES } from '@/features/accompagnement/views/interests-dashboard-view';
import { ServicePrice } from '@/features/document-services/components/service-parts';
import { TermsDialog } from '@/features/document-services/components/terms-dialog';
import { ORDER_FILTERS } from '@/features/document-services/lib/order-schema';
import { textIn } from '@/features/document-services/lib/service-schema';
import { toLocale } from '@/i18n/routing';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Filter = (typeof ORDER_FILTERS)[number];
type Order = RouterOutputs['documentServices']['orders']['dashboard']['list'][number];

/**
 * « Commandes » (#80): the Services documentaires ordered through their
 * private link, « À traiter » first. Approving opens the Client's Dossier and
 * sends the service's Contrat with the invoice; turning one down tells them why.
 */
export function ServiceOrdersView(): ReactNode {
  const t = useTranslations('DocumentServices.orders');
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  return (
    <section id="commandes" aria-labelledby="service-orders" className="grid scroll-mt-24 grid-cols-1 gap-4">
      <div>
        <h2 id="service-orders" className="font-heading text-xl font-bold text-navy-deep">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-slate">{t('intro')}</p>
      </div>
      <div role="group" aria-label={t('filterLabel')} className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {ORDER_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? 'inline-flex h-10 shrink-0 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold whitespace-nowrap text-white'
                : 'inline-flex h-10 shrink-0 items-center rounded-full border border-fog-light bg-white px-4 text-sm font-semibold whitespace-nowrap text-navy-deep hover:border-navy-deep'
            }
          >
            {t(`filters.${value}`)}
          </button>
        ))}
      </div>
      <QueryBoundary fallback={<OrdersSkeleton />}>
        <OrderList filter={filter} />
      </QueryBoundary>
    </section>
  );
}

function OrderList({ filter }: { filter: Filter }): ReactNode {
  const t = useTranslations('DocumentServices.orders');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  // « À traiter » is prefetched; another filter loads with the list kept on screen.
  const initial = useSuspenseQuery(trpc.documentServices.orders.dashboard.list.queryOptions({ filter: 'SUBMITTED' }));
  const other = useQuery({
    ...trpc.documentServices.orders.dashboard.list.queryOptions({ filter }),
    enabled: filter !== 'SUBMITTED',
    placeholderData: (previous) => previous,
  });
  const rows = filter === 'SUBMITTED' ? initial.data : (other.data ?? []);
  const [approving, setApproving] = useState<Order | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-8 text-center text-sm text-slate">
        {t('empty')}
      </p>
    );
  }
  return (
    <>
      <ul aria-busy={other.isFetching} className="grid grid-cols-1 gap-2">
        {rows.map((order) => (
          <li key={order.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy-deep">{order.account.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
                    {t(`status.${order.status}`)}
                  </span>
                </p>
                <p className="truncate text-sm text-slate">
                  {order.account.email} ·{' '}
                  {format.dateTime(order.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-navy-deep">
                  <span className="font-semibold">{textIn(order.service.name, locale)}</span>
                  <ServicePrice service={order.service} className="text-sm" />
                </p>
              </div>
              {order.status === 'SUBMITTED' ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setApproving(order)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
                  >
                    <FileSignature aria-hidden={true} className="size-4" />
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(order)}
                    aria-label={t('rejectLabel', { name: order.account.name })}
                    className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-rouge hover:bg-off-white"
                  >
                    {t('reject')}
                  </button>
                </div>
              ) : order.dossierId ? (
                <Link
                  href={`/dossiers/${order.dossierId}`}
                  className="inline-flex h-10 items-center rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
                >
                  {t('openDossier')}
                </Link>
              ) : null}
            </div>
            {order.note ? <p className="rounded-xl bg-off-white px-3 py-2 text-sm text-navy-deep">{order.note}</p> : null}
            {order.rejectNote ? <p className="text-sm text-slate">{order.rejectNote}</p> : null}
          </li>
        ))}
      </ul>
      {approving ? <ApproveDialog order={approving} onClose={() => setApproving(null)} /> : null}
      <RejectDialog order={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}

function ApproveDialog({ order, onClose }: { order: Order; onClose: () => void }): ReactNode {
  const t = useTranslations('DocumentServices.orders');
  const errors = useTranslations('Accompagnement.errors');
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const approve = useMutation(
    trpc.documentServices.orders.dashboard.approve.mutationOptions({
      onSuccess: ({ dossierId }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.orders.pathKey() });
        toast.add({ title: t('approved'), type: 'success' });
        onClose();
        router.push(`/dossiers/${dossierId}`);
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`) || errors.has(error.message);
        const title = t.has(`errors.${error.message}`) ? t(`errors.${error.message}`) : errors(known ? error.message : 'UNKNOWN');
        toast.add({ title, type: known ? 'warning' : 'error' });
      },
    }),
  );
  return (
    <TermsDialog
      service={order.service}
      initialLocale={toLocale(order.account.locale)}
      description={(lang) => t('approveBody', { service: textIn(order.service.name, lang), client: order.account.name })}
      pending={approve.isPending}
      onSubmit={(terms) => approve.mutate({ id: order.id, ...terms })}
      onClose={onClose}
    />
  );
}

function RejectDialog({ order, onClose }: { order: Order | null; onClose: () => void }): ReactNode {
  const t = useTranslations('DocumentServices.orders');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const reject = useMutation(
    trpc.documentServices.orders.dashboard.reject.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.orders.pathKey() });
        setNote('');
        toast.add({ title: t('rejected'), type: 'success' });
        onClose();
      },
      onError: () => toast.add({ title: t('errors.UNKNOWN'), type: 'error' }),
    }),
  );
  return (
    <AlertDialog open={order !== null} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="gap-4 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('rejectTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('rejectBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor={`${ids}-note`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('rejectNote')}
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
          <AlertDialogCancel className="rounded-full">{t('keep')}</AlertDialogCancel>
          <button
            type="button"
            disabled={reject.isPending}
            onClick={() => order && reject.mutate({ id: order.id, note: note.trim() })}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('rejectConfirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OrdersSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.orders');
  return (
    <div role="status" className="grid grid-cols-1 gap-2">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1].map((row) => (
        <Skeleton key={row} aria-hidden={true} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
