'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
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
import { DossierStatePill, StageStepper } from '@/features/dossiers/components/stage-stepper';
import { CLOSE_REASON_MAX, closeDossierInput } from '@/features/dossiers/lib/dossier-schema';
import { nextStage, previousStage } from '@/features/dossiers/lib/workflow';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useTRPC } from '@/trpc/client';

/** One Dossier in the Tableau de bord: its stages, the moves the consultant can make, its history. */
export function DossierDashboardView({ id }: { id: string }): ReactNode {
  const t = useTranslations('Dossiers.detail');
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dossiers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep">
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <QueryBoundary fallback={<DossierSkeleton />}>
        <DossierDetail id={id} />
      </QueryBoundary>
    </div>
  );
}

function DossierDetail({ id }: { id: string }): ReactNode {
  const t = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: dossier } = useSuspenseQuery(trpc.dossiers.dashboard.get.queryOptions({ id }));
  const [closing, setClosing] = useState(false);
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const stageLabel = (stage: string) => t(`stages.${dossier.service}.${stage}` as never);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.dossiers.dashboard.get.queryKey({ id }) });
    void queryClient.invalidateQueries({ queryKey: trpc.dossiers.dashboard.list.queryKey() });
  };
  const onMoved = (title: string) => () => {
    refresh();
    toast.add({ title, type: 'success' });
  };
  const onRefused = (error: { message: string }) => {
    if (error.message === 'DOSSIER_STAGE_CHANGED' || error.message === 'DOSSIER_CLOSED') {
      refresh();
      toast.add({ title: t('toast.stageChanged'), type: 'warning' });
      return;
    }
    toast.add({ title: t('toast.failed'), type: 'error' });
  };

  const advance = useMutation(
    trpc.dossiers.dashboard.advance.mutationOptions({ onSuccess: onMoved(t('toast.advanced')), onError: onRefused }),
  );
  const moveBack = useMutation(
    trpc.dossiers.dashboard.moveBack.mutationOptions({ onSuccess: onMoved(t('toast.movedBack')), onError: onRefused }),
  );
  const moving = advance.isPending || moveBack.isPending;
  const open = dossier.state === 'OPEN';
  const next = nextStage(dossier.service, dossier.stage);
  const previous = previousStage(dossier.service, dossier.stage);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-rouge">{t(`services.${dossier.service}`)}</p>
          <h1 className="font-heading text-3xl font-bold text-navy-deep">{dossier.account.name}</h1>
          <p className="mt-1 text-sm text-slate">
            {dossier.account.email} · {t('detail.openedOn', { date: date(dossier.createdAt) })}
          </p>
        </div>
        <DossierStatePill dossier={dossier} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm lg:col-span-2">
          <StageStepper service={dossier.service} stage={dossier.stage} startStage={dossier.startStage} />

          {open ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-off-white pt-5">
              <button
                type="button"
                disabled={!previous || moving}
                onClick={() => moveBack.mutate({ id, from: dossier.stage })}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50"
              >
                <ChevronLeft aria-hidden={true} className="size-4" />
                {t('detail.moveBack')}
              </button>
              {next ? (
                <button
                  type="button"
                  disabled={moving}
                  onClick={() => advance.mutate({ id, from: dossier.stage })}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
                >
                  {t('detail.advance')}
                  <ChevronRight aria-hidden={true} className="size-4" />
                </button>
              ) : (
                <p className="text-sm font-semibold text-leaf">{t('detail.lastStage')}</p>
              )}
              <button
                type="button"
                onClick={() => setClosing(true)}
                className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate hover:text-rouge"
              >
                <Lock aria-hidden={true} className="size-4" />
                {t('detail.close')}
              </button>
            </div>
          ) : (
            <p className="mt-5 border-t border-off-white pt-5 text-sm text-slate">
              {t('detail.closedOn', { date: date(dossier.closedAt ?? dossier.updatedAt) })}
              {dossier.closedReason ? ` · ${t('detail.closedReason', { reason: dossier.closedReason })}` : null}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-bold text-navy-deep">{t('detail.history')}</h2>
          <ol className="mt-3 grid gap-3">
            {[...dossier.events].reverse().map((event) => (
              <li key={event.id} className="text-sm">
                <p className="text-navy-deep">
                  {t(`detail.events.${event.kind}`, { to: stageLabel(event.toStage) })}
                  {event.note ? ` · ${event.note}` : null}
                </p>
                <p className="text-xs text-slate">
                  {format.dateTime(event.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {t('detail.by', { name: event.actor.name })}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <CloseDialog id={id} open={closing} onOpenChange={setClosing} onClosed={refresh} />
    </>
  );
}

/** Asks for the reason the Client will read, then closes the Dossier for good. */
function CloseDialog({
  id,
  open,
  onOpenChange,
  onClosed,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers');
  const trpc = useTRPC();
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);
  const close = useMutation(
    trpc.dossiers.dashboard.close.mutationOptions({
      onSuccess: () => {
        onClosed();
        onOpenChange(false);
        toast.add({ title: t('toast.closed'), type: 'info' });
      },
      onError: (error) => {
        if (error.message === 'DOSSIER_CLOSED') {
          onClosed();
          onOpenChange(false);
          toast.add({ title: t('toast.stageChanged'), type: 'warning' });
          return;
        }
        toast.add({ title: t('toast.failed'), type: 'error' });
      },
    }),
  );

  const submit = () => {
    const parsed = closeDossierInput.safeParse({ id, reason });
    setInvalid(!parsed.success);
    if (parsed.success) close.mutate(parsed.data);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('detail.closeTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('detail.closeBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <label htmlFor={fieldId} className="text-sm font-semibold text-navy-deep">
            {t('detail.closeReason')}
          </label>
          <textarea
            id={fieldId}
            value={reason}
            maxLength={CLOSE_REASON_MAX}
            rows={3}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${fieldId}-error` : undefined}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-xl border-2 border-fog-light px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
          />
          {invalid ? (
            <p id={`${fieldId}-error`} className="text-sm text-rouge">
              {t('detail.closeReasonError')}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('detail.cancel')}</AlertDialogCancel>
          <button
            type="button"
            disabled={close.isPending}
            onClick={submit}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('detail.confirmClose')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DossierSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.detail');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
