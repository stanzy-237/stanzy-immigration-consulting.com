'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ArrowRight, Check, ChevronLeft, Ellipsis, Lock, Video } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { AfterMain, AfterSide, PublishButton } from '@/features/consultation/components/consultation-after';
import { TOPIC_KEYS, type TopicKey } from '@/features/consultation/lib/booking-fields';
import { money } from '@/features/consultation/lib/money';
import { consultationInvoicePath } from '@/features/consultation/lib/payment';
import { fcfa } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { consultantRoomPath, DAY_BEFORE_MS } from '@/features/meetings/lib/meeting-schema';
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
 * 1 Avant`): who and when, « Rejoindre » (open 15 minutes before),
 * « Déplacer » and « ⋯ » (Renvoyer la confirmation, Voir le Compte, Annuler
 * ce créneau), what the Client prepared, Vos notes (private, autosaved), the
 * Déroulé of what they receive and when, the payment with its Facture, and
 * their Compte.
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
  const [cancelling, setCancelling] = useState(false);
  const firstName = data.client.name.trim().split(/\s+/)[0] ?? data.client.name;
  const starts = new Date(data.startsAt);
  // Once ended for everyone, its real end; else the planned one.
  const ends = data.meeting?.endedAt && data.over ? new Date(data.meeting.endedAt) : new Date(starts.getTime() + data.durationMinutes * 60_000);
  const opensAt = new Date(starts.getTime() - JOIN_BEFORE_MS);
  const paid = data.status === 'PAID';
  const after = paid && data.over;
  const live = paid && !after;
  const canJoin = live && data.meeting && now >= opensAt;
  const time = (d: Date) =>
    format.dateTime(d, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: DOUALA,
    });
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

      <header className="flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span aria-hidden={true} className="flex size-13 shrink-0 items-center justify-center rounded-full bg-blush font-heading text-body-lg font-extrabold text-rouge">
            {initials}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 title={data.client.name} className="truncate text-h4 leading-7 font-bold tracking-tight text-navy-deep lg:text-2xl">
                {data.client.name}
              </h1>
              {after ? (
                <span className="inline-block shrink-0 rounded-full bg-ice-blue px-2 py-0.5 font-label tracking-wide whitespace-nowrap text-ink">
                  {t('over', {
                    minutes: Math.max(1, Math.round((ends.getTime() - starts.getTime()) / 60_000)),
                  })}
                </span>
              ) : (
                <span className={cn('inline-block shrink-0 rounded-full px-2 py-0.5 font-label tracking-wide whitespace-nowrap', paid ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey')}>
                  {paid
                    ? t('paid', {
                        network: data.payment?.network === 'card' ? t('card') : (data.payment?.networkName ?? 'SasPay'),
                      })
                    : t('held')}
                </span>
              )}
            </div>
            <p className="text-body-sm leading-5 text-slate">
              {t('whenShort', {
                date: format.dateTime(starts, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: DOUALA,
                }),
                start: time(starts),
                end: time(ends),
              })}{' '}
              · {after ? data.recording ? t('recorded') : t('notRecorded') : <span className="font-bold text-ink">{format.relativeTime(starts, now)}</span>}
            </p>
          </div>
        </div>
        {paid ? (
          <div className="flex items-start gap-2.5">
            {live ? (
              <>
                <div className="flex flex-1 flex-col items-center gap-1 lg:flex-none">
                  {canJoin ? (
                    <Link
                      href={consultantRoomPath(data.meeting!.id)}
                      className={cn('flex h-11 w-full items-center justify-center gap-2 rounded-full bg-navy-deep px-5 font-heading text-body-sm font-bold text-white', PRESS)}
                    >
                      <Video aria-hidden={true} className="size-4" strokeWidth={2.2} />
                      {t('join')}
                    </Link>
                  ) : (
                    <span aria-disabled={true} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ice-blue px-5 font-heading text-body-sm font-bold text-slate">
                      <Video aria-hidden={true} className="size-4" strokeWidth={2.2} />
                      {t('join')}
                    </span>
                  )}
                  {canJoin ? null : <span className="text-label text-slate">{t('opensAt', { time: time(opensAt) })}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setMoving(true)}
                  className={cn('h-11 flex-1 rounded-full border-2 border-fog-light bg-white px-5 font-heading text-body-sm font-bold text-ink lg:flex-none', PRESS)}
                >
                  {t('move')}
                </button>
              </>
            ) : (
              <PublishButton data={data} firstName={firstName} />
            )}
            {/* « 2 Après » has no « ⋯ »: nothing to resend or cancel once it is over. */}
            {live ? <MoreMenu data={data} firstName={firstName} live={live} onCancel={() => setCancelling(true)} /> : null}
          </div>
        ) : null}
      </header>

      {after ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <AfterMain data={data} firstName={firstName} privateNotes={data.meeting ? <Notes id={data.id} initial={data.meeting.notes ?? ''} firstName={firstName} /> : null} />
          </div>
          <div className="flex w-full flex-col gap-6 lg:w-105 lg:shrink-0">
            <AfterSide data={data} firstName={firstName} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <Prepared data={data} firstName={firstName} />
            {data.meeting ? <Notes id={data.id} initial={data.meeting.notes ?? ''} firstName={firstName} /> : null}
          </div>
          <div className="flex w-full flex-col gap-6 lg:w-105 lg:shrink-0">
            {paid && data.meeting ? <Timeline data={data} meeting={data.meeting} firstName={firstName} /> : null}
            {data.payment ? <Payment payment={data.payment} /> : null}
            <Account data={data} />
          </div>
        </div>
      )}

      {live ? <CancelSlot id={data.id} firstName={firstName} open={cancelling} onOpenChange={setCancelling} /> : null}
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
        {[
          payment.network === 'card' ? t('card') : payment.networkName,
          payment.settledAt
            ? format.dateTime(new Date(payment.settledAt), {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: DOUALA,
              })
            : null,
          'SasPay',
        ]
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
        <span className="inline-block rounded-full bg-iris-tint px-2 py-0.5 font-label tracking-wide whitespace-nowrap text-iris">{tStatus(client.status as 'USER' | 'LEAD' | 'CLIENT')}</span>
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

type Step = {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'next' | 'later' | 'event';
};

/**
 * « Déroulé » (`Tableau de bord · Consultation · 1 Avant`): what the Client
 * receives and when, step by step: booked and paid, the reminder the day
 * before (only when booked at least 24 h ahead), 15 minutes before, then the
 * Consultation. Done steps show when they went out; the next one is marked.
 */
function Timeline({ data, meeting, firstName }: { data: Detail; meeting: NonNullable<Detail['meeting']>; firstName: string }): ReactNode {
  const t = useTranslations('Consultation.admin.detail.timeline');
  const format = useFormatter();
  const starts = new Date(data.startsAt);
  const ends = new Date(starts.getTime() + data.durationMinutes * 60_000);
  const at = (d: Date | string) =>
    format.dateTime(new Date(d), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: DOUALA,
    });
  const time = (d: Date) =>
    format.dateTime(d, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: DOUALA,
    });
  const dayBefore = new Date(starts.getTime() - DAY_BEFORE_MS);
  const plannedAhead = starts.getTime() - new Date(meeting.createdAt).getTime() >= DAY_BEFORE_MS;
  const over = data.ended || meeting.endedAt !== null;

  const steps: Omit<Step, 'state'>[] = [
    {
      key: 'paid',
      label: t('paid'),
      detail: data.payment?.settledAt ? t('paidDetail', { when: at(data.payment.settledAt) }) : '',
    },
    {
      key: 'dayBefore',
      label: t('dayBefore'),
      detail: meeting.remindedDayBefore ? t('sent', { when: at(meeting.remindedDayBefore) }) : plannedAhead ? t('planned', { when: at(dayBefore) }) : t('tooLate'),
    },
    {
      key: 'soon',
      label: t('soon'),
      detail: `${meeting.remindedSoon ? t('sent', { when: at(meeting.remindedSoon) }) : t('planned', { when: at(new Date(starts.getTime() - JOIN_BEFORE_MS)) })} · ${t('soonDetail')}`,
    },
    {
      key: 'consultation',
      label: t('consultation'),
      detail: `${format.dateTime(starts, { weekday: 'short', day: 'numeric', month: 'short', timeZone: DOUALA })} · ${time(starts)} – ${time(ends)}${over ? ` · ${t('over')}` : ''}`,
    },
  ];
  const isDone = (key: string) =>
    key === 'paid' || (key === 'dayBefore' && (meeting.remindedDayBefore !== null || !plannedAhead)) || (key === 'soon' && meeting.remindedSoon !== null) || (key === 'consultation' && over);
  let nextGiven = false;
  const states: Step[] = steps.map((step) => {
    if (isDone(step.key)) return { ...step, state: 'done' };
    if (step.key === 'consultation') return { ...step, state: 'event' };
    if (!nextGiven) {
      nextGiven = true;
      return { ...step, state: 'next' };
    }
    return { ...step, state: 'later' };
  });
  // A reminder skipped because it was booked late is not « done »: it never went out.
  const skipped = (step: Step) => step.key === 'dayBefore' && !plannedAhead && meeting.remindedDayBefore === null;

  return (
    <section aria-labelledby="timeline" className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="timeline" className={cardTitle}>
          {t('title')}
        </h2>
        <span className="text-caption text-slate">{t('lead', { name: firstName })}</span>
      </div>
      <ol className="flex flex-col">
        {states.map((step, i) => (
          <li key={step.key} className="flex gap-3">
            <span aria-hidden={true} className="flex w-5 flex-col items-center">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  step.state === 'done' && !skipped(step) && 'bg-leaf',
                  skipped(step) && 'border-2 border-dashed border-fog bg-white',
                  step.state === 'next' && 'border-2 border-steel-blue bg-white',
                  step.state === 'later' && 'border-2 border-fog bg-white',
                  step.state === 'event' && 'border-2 border-fog bg-white',
                )}
              >
                {step.state === 'done' && !skipped(step) ? <Check className="size-3 text-white" strokeWidth={3.5} /> : null}
                {step.state === 'event' ? <span className="size-2 rounded-full bg-rouge" /> : null}
              </span>
              {i < states.length - 1 ? <span className={cn('min-h-4 w-0.5 flex-1', step.state === 'done' && !skipped(step) ? 'bg-leaf' : 'bg-fog-light')} /> : null}
            </span>
            <span className={cn('flex flex-col gap-0.5', i < states.length - 1 && 'pb-3.5')}>
              <span className={cn('text-body-sm font-bold', skipped(step) ? 'text-slate' : 'text-ink')}>{step.label}</span>
              <span className={cn('text-caption leading-4', step.state === 'next' ? 'font-semibold text-steel-blue' : 'text-slate')}>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** « ⋯ »: Renvoyer la confirmation, Voir le Compte, Annuler ce créneau. */
function MoreMenu({ data, firstName, live, onCancel }: { data: Detail; firstName: string; live: boolean; onCancel: () => void }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const trpc = useTRPC();
  const resend = useMutation(
    trpc.consultationAdmin.resendConfirmation.mutationOptions({
      onSuccess: () =>
        toast.add({
          title: t('menu.resent', { email: data.client.email }),
          type: 'success',
        }),
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  const item = 'flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t('menu.label')} className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-navy-deep text-ink', PRESS)}>
        <Ellipsis aria-hidden={true} className="size-5" strokeWidth={2.4} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        <DropdownMenuItem disabled={resend.isPending} onClick={() => resend.mutate({ id: data.id })} className={item}>
          <span className="text-body-sm font-semibold text-ink">{t('menu.resend')}</span>
          <span className="text-caption text-slate">{t('menu.resendHint')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/comptes/${data.client.id}`} />} className={item}>
          <span className="text-body-sm font-semibold text-ink">{t('seeAccount')}</span>
        </DropdownMenuItem>
        {live ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCancel} className={cn(item, 'focus:bg-blush data-highlighted:bg-blush')}>
              <span className="text-body-sm font-bold text-rouge">{t('menu.cancel')}</span>
              <span className="text-caption text-rouge">{t('menu.cancelHint', { name: firstName })}</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
        await queryClient.invalidateQueries({
          queryKey: trpc.consultationAdmin.detail.queryKey({ id }),
        });
        toast.add({ title: t('moved'), type: 'success' });
        onClose();
      },
      onError: (error) =>
        toast.add({
          title: error instanceof TRPCClientError && error.message === 'SLOT_TAKEN' ? t('slotTaken') : t('error'),
          type: 'error',
        }),
    }),
  );
  const time = (iso: string) =>
    format.dateTime(new Date(iso), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: DOUALA,
    });
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
                  {format.dateTime(new Date(`${day.day}T12:00:00Z`), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  })}
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

/** « Annuler ce créneau » (from « ⋯ »): asks why, shows the next free slot the Client moves to, then moves. */
function CancelSlot({ id, firstName, open, onOpenChange }: { id: string; firstName: string; open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Consultation.admin.detail');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const setOpen = onOpenChange;
  const [reason, setReason] = useState('');
  const options = useQuery({
    ...trpc.consultationAdmin.moveOptions.queryOptions({ id }),
    enabled: open,
  });
  const cancel = useMutation(
    trpc.consultationAdmin.cancelSlot.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.consultationAdmin.detail.queryKey({ id }),
        });
        toast.add({
          title: t('cancelled', {
            name: firstName,
            when: format.dateTime(new Date(result.startsAt), {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: DOUALA,
            }),
          }),
          type: 'success',
        });
        setOpen(false);
      },
      onError: (error) =>
        toast.add({
          title: error instanceof TRPCClientError && error.message === 'NO_FREE_SLOT' ? t('noFreeSlot') : t('error'),
          type: 'error',
        }),
    }),
  );
  const next = options.data?.next;
  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-body-sm text-slate">
              {next
                ? t('cancelLead', {
                    name: firstName,
                    when: format.dateTime(new Date(next), {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: DOUALA,
                    }),
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
