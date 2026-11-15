'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
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
import { InterestAnswers } from '@/features/accompagnement/components/interest-answers';
import { LEVELS, REASON_MAX, startStageOf, type Level } from '@/features/accompagnement/lib/interest-schema';
import { STATUS_STYLES } from '@/features/accompagnement/views/interests-dashboard-view';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Interest = RouterOutputs['accompagnement']['dashboard']['get'];

/** One Demande d'intérêt (#81): every answer, the Niveau to keep or change, and the decision. */
export function InterestDashboardView({ id }: { id: string }): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-4xl gap-6">
      <Link
        href="/demandes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
      >
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <QueryBoundary fallback={<DetailSkeleton />}>
        <Detail id={id} />
      </QueryBoundary>
    </div>
  );
}

function Detail({ id }: { id: string }): ReactNode {
  const t = useTranslations('Accompagnement');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: interest } = useSuspenseQuery(trpc.accompagnement.dashboard.get.queryOptions({ id }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const level = interest.levelOverride ?? interest.level;
  const pending = interest.status === 'SUBMITTED';
  // Correctable before the decision and once accepted (#154); a refused Demande stays as it was.
  const editable = interest.status !== 'REJECTED';

  return (
    <>
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[interest.status]}`}>
            {t(`dashboard.status.${interest.status}`)}
          </span>
          <span className="rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold text-navy-deep">
            {t(`dashboard.levels.${level}`)}
          </span>
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-navy-deep md:text-3xl">{interest.account.name}</h1>
        <p className="text-sm text-slate">
          {interest.account.email} · {t('dashboard.sentOn', { date: date(interest.createdAt) })}
        </p>
        {interest.decidedAt && interest.decidedBy ? (
          <p className="text-sm text-slate">
            {t('dashboard.decidedOn', { date: date(interest.decidedAt), name: interest.decidedBy.name })}
          </p>
        ) : null}
        {interest.rejectReason ? (
          <p className="text-sm text-slate">{t('dashboard.rejectedWith', { reason: interest.rejectReason })}</p>
        ) : null}
      </div>

      {/* Keyed by the Niveau: a correction that changes it starts the choice again from it. */}
      {pending ? <Decision key={interest.level} interest={interest} /> : null}
      {interest.status === 'APPROVED' && interest.dossierId ? <Approved dossierId={interest.dossierId} /> : null}

      {interest.answersEditedAt ? (
        <p className="text-sm text-slate">
          {t('dashboard.edit.editedOn', {
            date: date(interest.answersEditedAt),
            name: interest.answersEditedBy?.name ?? 'Stanzy',
          })}
        </p>
      ) : null}
      {editable && !pending ? (
        <p className="rounded-xl bg-honey-tint px-4 py-3 text-sm text-navy-deep">{t('dashboard.edit.approvedHint')}</p>
      ) : null}
      <InterestAnswers interest={interest} editable={editable} />

      {interest.history.length > 0 ? (
        <section aria-labelledby="interest-history" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
          <h2 id="interest-history" className="mb-2 font-heading text-lg font-bold text-navy-deep">
            {t('dashboard.history')}
          </h2>
          <ul className="grid grid-cols-1 gap-1 text-sm">
            {interest.history.map((earlier) => (
              <li key={earlier.id}>
                <Link href={`/demandes/${earlier.id}`} className="font-semibold text-navy-deep hover:text-rouge">
                  {date(earlier.createdAt)}
                </Link>{' '}
                · {t(`dashboard.status.${earlier.status}`)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** The Niveau (kept or changed), the stage the Dossier will open at, and « Accepter » or « Refuser ». */
function Decision({ interest }: { interest: Interest }): ReactNode {
  const t = useTranslations('Accompagnement');
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<Level>(interest.levelOverride ?? interest.level);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const refresh = () => void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.dashboard.pathKey() });
  const failed = (error: { message: string }) => {
    const known = t.has(`errors.${error.message}`);
    refresh();
    toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
  };
  const approve = useMutation(
    trpc.accompagnement.dashboard.approve.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.approved'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const reject = useMutation(
    trpc.accompagnement.dashboard.reject.mutationOptions({
      onSuccess: () => {
        refresh();
        setRejecting(false);
        toast.add({ title: t('toast.rejected'), type: 'success' });
      },
      onError: failed,
    }),
  );
  const stage = startStageOf(level, interest.answers.progress.ita);

  return (
    <section aria-labelledby="interest-decision" className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-navy-deep bg-white p-5">
      <h2 id="interest-decision" className="font-heading text-lg font-bold text-navy-deep">
        {t('dashboard.decision')}
      </h2>
      <p className="text-sm text-slate">{t('dashboard.levelComputed', { level: t(`dashboard.levels.${interest.level}`) })}</p>
      <label htmlFor={`${ids}-level`} className="grid grid-cols-1 max-w-xs gap-1 text-sm font-semibold text-navy-deep">
        {t('dashboard.levelChoose')}
        <select
          id={`${ids}-level`}
          value={level}
          onChange={(event) => setLevel(event.target.value as Level)}
          className="h-11 rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
        >
          {LEVELS.map((choice) => (
            <option key={choice} value={choice}>
              {t(`dashboard.levels.${choice}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-navy-deep">{t('dashboard.stage', { stage: stages(stage) })}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={approve.isPending}
          onClick={() => approve.mutate({ id: interest.id, level })}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Check aria-hidden={true} className="size-4" />
          {approve.isPending ? t('dashboard.approving') : t('dashboard.approve')}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          <X aria-hidden={true} className="size-4" />
          {t('dashboard.reject')}
        </button>
      </div>

      <AlertDialog open={rejecting} onOpenChange={setRejecting}>
        <AlertDialogContent className="gap-4 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('dashboard.rejectTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('dashboard.rejectBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor={`${ids}-reason`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t('dashboard.rejectReason')}
            <textarea
              id={`${ids}-reason`}
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('dashboard.keep')}</AlertDialogCancel>
            <button
              type="button"
              disabled={reject.isPending}
              onClick={() => reject.mutate({ id: interest.id, reason: reason.trim() })}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {t('dashboard.rejectConfirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Once approved: the Dossier, the Contrat d'accompagnement to send first, then the invoice. */
function Approved({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-leaf-tint p-5">
      <p className="text-sm text-navy-deep">{t('next')}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dossiers/${dossierId}`}
          className="inline-flex h-11 items-center rounded-full border-2 border-navy-deep bg-white px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
        >
          {t('dossier')}
        </Link>
        <Link
          href={`/dossiers/${dossierId}?onglet=facturation&contrat=nouveau#contrats`}
          className="inline-flex h-11 items-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
        >
          {t('contract')}
        </Link>
        <Link
          href={`/factures/nouvelle?dossier=${dossierId}`}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-white"
        >
          {t('invoice')}
        </Link>
      </div>
    </div>
  );
}

function DetailSkeleton(): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-16 w-72 rounded-xl" />
      <Skeleton aria-hidden={true} className="h-40 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-64 rounded-2xl" />
    </div>
  );
}
