'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ArrowRight, ChevronLeft, Lock, Video } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

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
import { TOPIC_KEYS, type TopicKey } from '@/features/consultation/lib/booking-fields';
import { money } from '@/features/consultation/lib/money';
import { consultationInvoicePath } from '@/features/consultation/lib/payment';
import { fcfa } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { consultantRoomPath } from '@/features/meetings/lib/meeting-schema';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['consultationAdmin']['detail'];

const DOUALA = 'Africa/Douala';
const JOIN_BEFORE_MS = 15 * 60_000;
const card = 'flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-6';
const cardTitle = 'font-heading text-h4 font-bold text-navy-deep';

/**
 * One Consultation in the Tableau de bord (`Tableau de bord · Consultation ·
 * 1 Avant`): who and when, « Déplacer » and « Rejoindre » (open 15 minutes
 * before), what the Client prepared, Vos notes (private, autosaved), the
 * payment with its Facture, their Compte, the reminders sent, and « Annuler
 * ce créneau », which moves them to the next free slot.
 */
export function ConsultationAdminView({ id }: { id: string }): ReactNode {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <QueryBoundary fallback={<DetailSkeleton />}>
        <Consultation id={id} />
      </QueryBoundary>
    </div>
  );
}

function Consultation({ id }: { id: string }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.detail.queryOptions({ id }));
  const [moving, setMoving] = useState(false);
  const firstName = data.client.name.trim().split(/\s+/)[0] ?? data.client.name;
  const starts = new Date(data.startsAt);
  const ends = new Date(starts.getTime() + data.durationMinutes * 60_000);
  const opensAt = new Date(starts.getTime() - JOIN_BEFORE_MS);
  const paid = data.status === 'PAID';
  const live = paid && !data.ended;
  const canJoin = live && data.meeting && now >= opensAt;
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const initials = data.client.name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Link href="/consultations" className="flex items-center gap-1.5 self-start text-body-sm font-semibold text-ink">
        <ChevronLeft aria-hidden={true} className="size-4" strokeWidth={2.5} />
        {t('back')}
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden={true} className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blush font-heading text-h4 font-extrabold text-rouge">
            {initials}
          </span>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-h3 leading-8 font-extrabold tracking-tight text-navy-deep lg:text-h2 lg:leading-11">{data.client.name}</h1>
              <span className={cn('rounded-full px-2.5 py-1 font-label text-caption font-bold', paid ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey')}>
                {paid ? t('paid', { network: data.payment?.network === 'card' ? t('card') : (data.payment?.networkName ?? 'SasPay') }) : t('held')}
              </span>
            </div>
            <p className="text-body leading-6 text-slate">
              {t('when', {
                date: format.dateTime(starts, { weekday: 'long', day: 'numeric', month: 'short', timeZone: DOUALA }),
                start: time(starts),
                end: time(ends),
                relative: format.relativeTime(starts, now),
              })}
            </p>
          </div>
        </div>
        {live ? (
          <div className="flex flex-col items-stretch gap-1.5 lg:items-end">
            <div className="flex gap-3">
              <button type="button" onClick={() => setMoving(true)} className={cn('h-12 flex-1 rounded-full border-2 border-fog-light bg-white px-6 font-heading text-body-sm font-bold text-ink lg:flex-none', PRESS)}>
                {t('move')}
              </button>
              {canJoin ? (
                <Link href={consultantRoomPath(data.meeting!.id)} className={cn('flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-navy-deep px-6 font-heading text-body-sm font-bold text-white lg:flex-none', PRESS)}>
                  <Video aria-hidden={true} className="size-4.5" strokeWidth={2.2} />
                  {t('join')}
                </Link>
              ) : (
                <span aria-disabled={true} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ice-blue px-6 font-heading text-body-sm font-bold text-slate lg:flex-none">
                  <Video aria-hidden={true} className="size-4.5" strokeWidth={2.2} />
                  {t('join')}
                </span>
              )}
            </div>
            {canJoin ? null : <p className="text-center text-caption text-slate lg:text-right">{t('opensAt', { time: time(opensAt) })}</p>}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Prepared data={data} firstName={firstName} />
          {data.meeting ? <Notes id={data.id} initial={data.meeting.notes ?? ''} firstName={firstName} /> : null}
        </div>
        <div className="flex w-full flex-col gap-6 lg:w-105 lg:shrink-0">
          {data.payment ? <Payment payment={data.payment} /> : null}
          <Account data={data} />
          {data.meeting ? <Reminders meeting={data.meeting} /> : null}
        </div>
      </div>

      {live ? <CancelSlot id={data.id} firstName={firstName} /> : null}
      {live && moving ? <MoveDialog id={data.id} onClose={() => setMoving(false)} /> : null}
    </>
  );
}

/** « Ce qu'Aminata a préparé »: topics, CRS, ITA, the situation as a quote. */
function Prepared({ data, firstName }: { data: Detail; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const tTopics = useTranslations('Consultation.reservation.prepare.topic');
  const { topics, crsScore, itaReceived, situation } = data.answers;
  const nothing = topics.length === 0 && crsScore === null && itaReceived === null && !situation;
  return (
    <section aria-labelledby="prepared" className={card}>
      <div className="flex flex-col gap-1">
        <h2 id="prepared" className={cardTitle}>
          {/* « Ce qu’Aminata », « Ce que Paul »: French elides before a vowel or a mute h. */}
          {t(/^[aeiouyhàâäéèêëîïôöûü]/i.test(firstName) ? 'preparedElided' : 'prepared', { name: firstName })}
        </h2>
        <p className="text-body-sm text-slate">{t('preparedLead')}</p>
      </div>
      {nothing ? <p className="rounded-xl bg-off-white px-4 py-3 text-body-sm text-slate">{t('nothingPrepared')}</p> : null}
      {topics.length ? (
        <div className="flex flex-col gap-2">
          <p className={cn(LABEL_CLASS, 'text-slate')}>{t('topics')}</p>
          <ul className="flex flex-wrap gap-2">
            {topics
              .filter((topic): topic is TopicKey => (TOPIC_KEYS as readonly string[]).includes(topic))
              .map((topic) => (
                <li key={topic} className="rounded-full bg-blush px-3 py-1.5 text-body-sm font-semibold text-rouge">
                  {tTopics(topic)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {crsScore !== null || itaReceived !== null ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-off-white p-4">
            <p className="text-caption text-slate">{t('crs')}</p>
            <p className="font-heading text-h3 font-extrabold text-ink">{crsScore ?? '—'}</p>
          </div>
          <div className="rounded-2xl bg-off-white p-4">
            <p className="text-caption text-slate">{t('ita')}</p>
            <p className="font-heading text-h4 font-bold text-ink">{itaReceived === null ? '—' : itaReceived ? t('itaYes') : t('itaNo')}</p>
          </div>
        </div>
      ) : null}
      {situation ? (
        <div className="flex flex-col gap-2">
          <p className={cn(LABEL_CLASS, 'text-slate')}>{t('situation')}</p>
          <blockquote className="rounded-r-xl border-l-3 border-rouge bg-off-white px-4 py-3 text-body leading-6 text-ink">« {situation} »</blockquote>
        </div>
      ) : null}
    </section>
  );
}

/** Vos notes: private, saved a moment after typing stops; kept as the Réunion's notes. */
function Notes({ id, initial, firstName }: { id: string; initial: string; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const trpc = useTRPC();
  const field = useId();
  const [notes, setNotes] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // `mutate` is stable across renders (the mutation object is not): the timer only restarts when the text changes.
  const { mutate: saveNotes } = useMutation(trpc.consultationAdmin.saveNotes.mutationOptions());
  const last = useRef(initial);

  useEffect(() => {
    if (notes === last.current) return;
    const timer = window.setTimeout(() => {
      setState('saving');
      saveNotes(
        { id, notes },
        {
          onSuccess: () => {
            last.current = notes;
            setState('saved');
          },
          onError: () => setState('error'),
        },
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [notes, id, saveNotes]);

  return (
    <section aria-labelledby="notes" className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="notes" className={cardTitle}>
          <label htmlFor={field}>{t('notes')}</label>
        </h2>
        <span className="flex items-center gap-1.5 text-caption text-slate">
          <Lock aria-hidden={true} className="size-3.5" strokeWidth={2.2} />
          {t('private', { name: firstName })}
        </span>
      </div>
      <textarea
        id={field}
        rows={4}
        maxLength={20_000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="min-h-28 resize-y rounded-xl border border-fog px-4 py-3 text-body leading-6 text-ink outline-none focus:border-2 focus:border-navy-deep"
      />
      <p aria-live="polite" className={cn('text-caption', state === 'error' ? 'font-semibold text-rouge' : 'text-slate')}>
        {state === 'saving' ? t('saving') : state === 'error' ? t('saveError') : t('autosaved')}
      </p>
    </section>
  );
}

function Payment({ payment }: { payment: NonNullable<Detail['payment']> }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const paid = payment.charged ?? payment.amount;
  return (
    <section aria-labelledby="payment" className={card}>
      <h2 id="payment" className={cardTitle}>
        {t('payment')}
      </h2>
      <dl className="flex flex-col gap-2 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-slate">{t('price')}</dt>
          <dd className={cn('text-ink', payment.discount > 0 && 'text-slate line-through')}>{fcfa(payment.price, 'fr-FR')}</dd>
        </div>
        {payment.discount > 0 && payment.promo ? (
          <div className="flex justify-between text-leaf">
            <dt>
              {payment.promo.code} · {payment.promo.reductionType === 'PERCENT' ? `−${payment.promo.reductionValue} %` : ''}
            </dt>
            <dd>−{fcfa(payment.discount, 'fr-FR')}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between border-t border-fog-light pt-3">
          <dt className="text-body font-bold text-ink">{t('paidAmount')}</dt>
          <dd className="text-body font-bold text-ink">{money(paid, payment.currency, 'fr-FR')}</dd>
        </div>
      </dl>
      <p className="text-caption text-slate">
        {[payment.network === 'card' ? t('card') : payment.networkName, payment.settledAt ? format.dateTime(new Date(payment.settledAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }) : null, 'SasPay']
          .filter(Boolean)
          .join(' · ')}
      </p>
      {payment.invoiceNumber ? (
        <a href={consultationInvoicePath(payment.id)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-off-white px-4 py-3 text-body-sm">
          <span className="font-bold text-ink">{t('invoice', { number: payment.invoiceNumber })}</span>
          <span className="font-semibold text-rouge">{t('view')}</span>
        </a>
      ) : null}
    </section>
  );
}

function Account({ data }: { data: Detail }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const tStatus = useTranslations('Consultation.admin.row.status');
  const { client } = data;
  return (
    <section aria-labelledby="account" className={card}>
      <div className="flex items-center justify-between">
        <h2 id="account" className={cardTitle}>
          {t('account')}
        </h2>
        <span className="rounded-full bg-iris-tint px-2.5 py-1 font-label text-caption font-bold text-iris">{tStatus(client.status as 'USER' | 'LEAD' | 'CLIENT')}</span>
      </div>
      <div className="flex flex-col gap-1 text-body-sm text-ink">
        <p>{client.email}</p>
        <p>
          {client.phone} · {client.country}
        </p>
      </div>
      <p className="text-caption leading-5 text-slate">{client.dossiers === 0 ? t('noDossier') : t('dossiers', { count: client.dossiers })}</p>
      <div className="flex flex-wrap gap-5 text-body-sm font-bold text-rouge">
        <Link href={`/comptes/${client.id}`} className="flex items-center gap-1">
          {t('seeAccount')} <ArrowRight aria-hidden={true} className="size-3.5" strokeWidth={2.5} />
        </Link>
        <Link href={`/dossiers/nouveau?account=${client.id}`} className="flex items-center gap-1">
          {t('openDossier')} <ArrowRight aria-hidden={true} className="size-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

function Reminders({ meeting }: { meeting: NonNullable<Detail['meeting']> }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const at = (d: Date | null, withDay: boolean) =>
    d
      ? format.dateTime(new Date(d), withDay ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: DOUALA } : { hour: '2-digit', minute: '2-digit', timeZone: DOUALA })
      : t('notYet');
  return (
    <section aria-labelledby="reminders" className={card}>
      <h2 id="reminders" className={cardTitle}>
        {t('reminders')}
      </h2>
      <dl className="flex flex-col gap-2 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-ink">{t('dayBefore')}</dt>
          <dd className="text-slate">{at(meeting.remindedDayBefore, true)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink">{t('soon')}</dt>
          <dd className="text-slate">{at(meeting.remindedSoon, false)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** « Déplacer »: the free starts, by day; picking one moves the Consultation and tells the Client. */
function MoveDialog({ id, onClose }: { id: string; onClose: () => void }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = useQuery(trpc.consultationAdmin.moveOptions.queryOptions({ id }));
  const [chosen, setChosen] = useState<string | null>(null);
  const move = useMutation(
    trpc.consultationAdmin.move.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationAdmin.detail.queryKey({ id }) });
        toast.add({ title: t('moved'), type: 'success' });
        onClose();
      },
      onError: (error) => toast.add({ title: error instanceof TRPCClientError && error.message === 'SLOT_TAKEN' ? t('slotTaken') : t('error'), type: 'error' }),
    }),
  );
  const time = (iso: string) => format.dateTime(new Date(iso), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-h-dvh gap-5 overflow-y-auto p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('moveTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-body-sm text-slate">{t('moveLead')}</AlertDialogDescription>
        </AlertDialogHeader>
        {options.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : options.data?.days.length ? (
          <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
            {options.data.days.slice(0, 14).map((day) => (
              <fieldset key={day.day} className="flex flex-col gap-2">
                <legend className="mb-2 text-body-sm font-bold text-ink first-letter:uppercase">
                  {format.dateTime(new Date(`${day.day}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {day.starts.map((start) => (
                    <label key={start} className={cn('cursor-pointer rounded-lg px-3 py-2 text-body-sm font-semibold', chosen === start ? 'bg-navy-deep text-white' : 'bg-ice-blue text-ink')}>
                      <input type="radio" name="move" className="sr-only" checked={chosen === start} onChange={() => setChosen(start)} />
                      {time(start)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <p className="text-body-sm text-slate">{t('noFreeSlot')}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
          <button
            type="button"
            disabled={!chosen || move.isPending}
            onClick={() => chosen && move.mutate({ id, start: chosen })}
            className="rounded-full bg-navy-deep px-5 py-2 text-body-sm font-semibold text-white disabled:opacity-50"
          >
            {t('moveConfirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** « Annuler ce créneau → Aminata passe au prochain créneau libre »: asks why, shows that slot, then moves. */
function CancelSlot({ id, firstName }: { id: string; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const options = useQuery({ ...trpc.consultationAdmin.moveOptions.queryOptions({ id }), enabled: open });
  const cancel = useMutation(
    trpc.consultationAdmin.cancelSlot.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationAdmin.detail.queryKey({ id }) });
        toast.add({
          title: t('cancelled', {
            name: firstName,
            when: format.dateTime(new Date(result.startsAt), { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }),
          }),
          type: 'success',
        });
        setOpen(false);
      },
      onError: (error) => toast.add({ title: error instanceof TRPCClientError && error.message === 'NO_FREE_SLOT' ? t('noFreeSlot') : t('error'), type: 'error' }),
    }),
  );
  const next = options.data?.next;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="self-end text-body-sm font-bold text-rouge">
        {t('cancelSlot', { name: firstName })}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-body-sm text-slate">
              {next
                ? t('cancelLead', {
                    name: firstName,
                    when: format.dateTime(new Date(next), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }),
                  })
                : options.isPending
                  ? t('looking')
                  : t('noFreeSlot')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor={reasonId} className="flex flex-col gap-2 text-body-sm font-semibold text-ink">
            {t('reason')}
            <textarea
              id={reasonId}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl border border-fog px-3 py-2 font-normal outline-none focus:border-2 focus:border-navy-deep"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('keep')}</AlertDialogCancel>
            <button
              type="button"
              disabled={reason.trim().length < 3 || !next || cancel.isPending}
              onClick={() => cancel.mutate({ id, reason })}
              className="rounded-full bg-rouge px-5 py-2 text-body-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {t('cancelConfirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailSkeleton(): ReactNode {
  const t = useTranslations('Consultation.admin');
  return (
    <div role="status" className="flex animate-skeleton-in flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-16 w-96" />
      <div aria-hidden={true} className="flex gap-6">
        <Skeleton className="h-96 flex-1 rounded-3xl" />
        <Skeleton className="hidden h-96 w-105 rounded-3xl lg:block" />
      </div>
    </div>
  );
}
