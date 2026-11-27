'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronLeft, Download, FileText } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { clockOfSeconds } from '@/features/consultation/components/consultation-after';
import { CameraTest, CheckMark, MoveDialog, NextConsultationCard, StanzyCard, useCameraTested } from '@/features/consultation/components/space-parts';
import { TOPIC_KEYS, type TopicKey } from '@/features/consultation/lib/booking-fields';
import { money } from '@/features/consultation/lib/money';
import { consultationInvoicePath } from '@/features/consultation/lib/payment';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { TAB_BAR_ROOM } from '@/features/shared/components/space-tab-bar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['consultationSpace']['detail'];
type Published = NonNullable<Detail['published']>;
const DOUALA = 'Africa/Douala';
const card = 'flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-6';

/**
 * One of my Consultations (`Mon espace v2 · 1 Avant`, `3 Après · Récap`):
 * before it, what to prepare, « Déplacer » and the Facture; after it, once
 * Stanzy has published, the video, his notes, the transcript, the next steps.
 */
export function MyConsultationView({ id }: { id: string }): ReactNode {
  return (
    <>
      <SiteNav />
      <main className={cn('min-h-screen bg-off-white px-4 py-8 md:py-12', TAB_BAR_ROOM)}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <QueryBoundary fallback={<Skeleton className="h-96 rounded-3xl" />}>
            <Consultation id={id} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Consultation({ id }: { id: string }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationSpace.detail.queryOptions({ id }));
  if (data.over && data.published) return <After data={data} published={data.published} />;
  return (
    <>
      {data.over ? <Preparing data={data} /> : <Before data={data} />}
    </>
  );
}

function Back(): ReactNode {
  const t = useTranslations('Consultation.space');
  return (
    <Link href="/mon-espace/consultations" className="flex items-center gap-1.5 self-start text-body-sm font-bold text-ink">
      <ChevronLeft aria-hidden={true} className="size-4" strokeWidth={2.5} />
      {t('tabs.consultations')}
    </Link>
  );
}

function Before({ data }: { data: Detail }): ReactNode {
  const t = useTranslations('Consultation.space');
  const tTopics = useTranslations('Consultation.reservation.prepare.topic');
  const format = useFormatter();
  const [moving, setMoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested] = useCameraTested();
  const { topics, crsScore } = data.answers;
  const topicLabels = topics.filter((x): x is TopicKey => (TOPIC_KEYS as readonly string[]).includes(x)).map((x) => tTopics(x));
  const answered = topicLabels.length > 0 || crsScore !== null || Boolean(data.answers.situation);
  const done = Number(answered) + Number(tested);
  const answersLine = [crsScore !== null ? t('before.crs', { score: crsScore }) : null, ...topicLabels].filter(Boolean).join(' · ');

  return (
    <>
      <Back />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <NextConsultationCard
            consultation={{ id: data.id, startsAt: data.startsAt, durationMinutes: data.durationMinutes, meetingId: data.meetingId, paymentId: data.payment?.id }}
            action={
              data.canMove ? (
                <button type="button" onClick={() => setMoving(true)} className={cn('flex h-13 items-center justify-center rounded-full border border-white/30 px-6 font-heading text-body font-bold text-white hover:bg-white/10', PRESS)}>
                  {t('before.move')}
                </button>
              ) : null
            }
          />
          <section aria-labelledby="before-meeting" className={card}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="before-meeting" className="font-heading text-h4 font-bold text-navy-deep">
                {t('before.title')}
              </h2>
              <span className="text-caption font-semibold text-slate">{t('before.progress', { done, total: 2 })}</span>
            </div>
            <div className={cn('flex items-center gap-4 rounded-2xl p-4', answered ? 'bg-leaf-tint' : 'border border-fog-light')}>
              <CheckMark done={answered} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-body-sm font-bold text-ink">{answered ? t('before.answers') : t('before.noAnswers')}</p>
                {answersLine ? <p className="truncate text-caption text-slate">{answersLine}</p> : null}
              </div>
            </div>
            <div className={cn('flex items-center gap-4 rounded-2xl p-4', tested ? 'bg-leaf-tint' : 'border-2 border-navy-deep')}>
              <CheckMark done={tested} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-body-sm font-bold text-ink">{t('before.camera')}</p>
                <p className="text-caption text-slate">{t('before.cameraHint')}</p>
              </div>
              <button type="button" onClick={() => setTesting(true)} className={cn('h-10 shrink-0 rounded-full bg-navy-deep px-5 text-body-sm font-bold text-white', PRESS)}>
                {tested ? t('before.retest') : t('before.test')}
              </button>
            </div>
          </section>
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-100 lg:shrink-0">
          <StanzyCard />
          {data.payment ? <InvoiceCard payment={data.payment} /> : null}
          <section className="flex flex-col gap-2 rounded-3xl border border-dashed border-fog p-5">
            <h2 className="text-body-sm font-bold text-ink">{t('before.obstacle')}</h2>
            <p className="text-body-sm leading-5 text-slate">
              {data.canMove
                ? t('before.moveUntil', { hours: data.moveCutoffHours, until: format.dateTime(new Date(data.moveUntil), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }) })
                : t('before.moveClosed')}
            </p>
            {data.canMove ? (
              <button type="button" onClick={() => setMoving(true)} className="self-start text-body-sm font-bold text-rouge underline underline-offset-2">
                {t('before.moveSlot')}
              </button>
            ) : null}
          </section>
        </aside>
      </div>
      <CameraTest open={testing} onOpenChange={setTesting} />
      {data.canMove ? <MoveDialog id={data.id} startsAt={data.startsAt} open={moving} onOpenChange={setMoving} /> : null}
    </>
  );
}

function InvoiceCard({ payment }: { payment: NonNullable<Detail['payment']> }): ReactNode {
  const t = useTranslations('Consultation.space');
  const line = [money(payment.amount, payment.currency, 'fr-FR'), payment.network, payment.promo].filter(Boolean).join(' · ');
  const inner = (
    <>
      <span aria-hidden={true} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-leaf-tint text-leaf">
        <FileText className="size-5" strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-sm font-bold text-ink">{payment.invoiceNumber ? t('invoice', { number: payment.invoiceNumber }) : t('paid')}</span>
        <span className="truncate text-caption text-slate">{line}</span>
      </span>
      {payment.invoiceNumber ? <Download aria-hidden={true} className="size-4 shrink-0 text-ink" strokeWidth={2.4} /> : <span className="rounded-full bg-leaf-tint px-2.5 py-0.5 text-caption font-semibold text-leaf">{t('paidBadge')}</span>}
    </>
  );
  return payment.invoiceNumber ? (
    <a href={consultationInvoicePath(payment.id)} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-3xl border border-fog-light bg-white p-5 hover:border-fog">
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-4 rounded-3xl border border-fog-light bg-white p-5">{inner}</div>
  );
}

/** Over, not published yet: Stanzy is writing the recap. */
function Preparing({ data }: { data: Detail }): ReactNode {
  const t = useTranslations('Consultation.space.preparing');
  const format = useFormatter();
  return (
    <>
      <Back />
      <section className="flex flex-col items-center gap-5 rounded-3xl border border-fog-light bg-white p-8 text-center md:flex-row md:p-12 md:text-left">
        <Image src="/email/recording.png" alt="" width={150} height={150} className="size-36 shrink-0" />
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-h4 font-extrabold text-navy-deep md:text-h3">
            {t('title', { date: format.dateTime(new Date(data.startsAt), { day: 'numeric', month: 'long', timeZone: DOUALA }) })}
          </h1>
          <p className="text-body leading-6 text-slate">{t('lead')}</p>
        </div>
      </section>
      {data.payment ? <InvoiceCard payment={data.payment} /> : null}
    </>
  );
}

/** « Consultation du 25 novembre » (`3 Après · Récap`): video, notes, transcript, steps, and what comes next. */
function After({ data, published }: { data: Detail; published: Published }): ReactNode {
  const t = useTranslations('Consultation.space.after');
  const tSpace = useTranslations('Consultation.space');
  const format = useFormatter();
  const video = useRef<HTMLVideoElement>(null);
  const [tab, setTab] = useState<'notes' | 'transcript'>('notes');
  // The note whose time was tapped: its background changes (consultation-motion: 150 ms ease).
  const [current, setCurrent] = useState<string | null>(null);
  const seek = (seconds: number, noteId?: string) => {
    if (noteId) setCurrent(noteId);
    if (!video.current) return;
    video.current.currentTime = seconds;
    void video.current.play().catch(() => undefined);
  };
  const recording = published.recording;
  return (
    <>
      <div className="max-sm:hidden">
        <Back />
      </div>
      <div className="flex items-center gap-3">
        {/* Phone (`3 Après · Récap · Mobile`): a round back button beside the title. */}
        <Link href="/mon-espace/consultations" aria-label={tSpace('tabs.consultations')} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-fog-light bg-white sm:hidden">
          <ChevronLeft aria-hidden={true} className="size-5 text-navy-deep" strokeWidth={2.5} />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1.5">
          <h1 className="font-heading text-h4 leading-7 font-extrabold tracking-tight text-navy-deep sm:text-h3 sm:leading-9 md:text-h2 md:leading-11">
            <span className="sm:hidden">{t('title', { date: format.dateTime(new Date(data.startsAt), { day: 'numeric', month: 'short', timeZone: DOUALA }) })}</span>
            <span className="max-sm:hidden">{t('title', { date: format.dateTime(new Date(data.startsAt), { day: 'numeric', month: 'long', timeZone: DOUALA }) })}</span>
          </h1>
          <p className="text-body-sm text-slate sm:text-body">
            <span className="sm:hidden">{t('phoneMeta', { minutes: data.minutes })}</span>
            <span className="max-sm:hidden">{t('meta', { minutes: data.minutes })}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {recording ? (
            <section aria-label={t('video')} className="flex flex-col gap-3 rounded-3xl bg-navy-deep p-4 lg:p-5">
              <video
                ref={video}
                src={`/api/consultation/recordings/${data.id}`}
                controls={true}
                controlsList="nodownload"
                disablePictureInPicture={true}
                onContextMenu={(e) => e.preventDefault()}
                preload="metadata"
                className="aspect-video w-full rounded-2xl bg-ink-deep"
              />
              <div aria-hidden={published.notes.length === 0} className="relative h-3 w-full rounded-full bg-white/15">
                {published.notes
                  .filter((n): n is typeof n & { atSeconds: number } => n.atSeconds !== null)
                  .map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      aria-label={t('goTo', { time: clockOfSeconds(note.atSeconds) })}
                      title={note.text}
                      onClick={() => seek(note.atSeconds, note.id)}
                      className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-white hover:bg-rose"
                      style={{ left: `${Math.min(100, (note.atSeconds / recording.seconds) * 100)}%` }}
                    />
                  ))}
              </div>
            </section>
          ) : (
            <p className="rounded-3xl bg-navy-deep p-6 text-body-sm text-white/80">{t('noVideo')}</p>
          )}
          <div role="tablist" aria-label={t('tabsLabel')} className="flex gap-6 border-b border-fog-light max-sm:gap-0 max-sm:rounded-full max-sm:border-0 max-sm:bg-ice-blue max-sm:p-1">
            {(['notes', 'transcript'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-body font-bold max-sm:mb-0 max-sm:flex-1 max-sm:rounded-full max-sm:border-0 max-sm:py-2.5 max-sm:text-body-sm',
                  tab === key ? 'border-rouge text-navy-deep max-sm:bg-white max-sm:shadow-sm' : 'border-transparent text-slate',
                )}
              >
                {t(key)}
              </button>
            ))}
          </div>
          {tab === 'notes' ? (
            published.notes.length ? (
              <ul className="flex flex-col gap-3">
                {published.notes.map((note) => (
                  <li key={note.id} className={cn('-mx-2 flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors duration-150 ease-out', current === note.id && 'bg-ice-blue/60')}>
                    {note.atSeconds !== null ? (
                      <button type="button" onClick={() => seek(note.atSeconds!, note.id)} className="shrink-0 rounded-md bg-ice-blue px-2 py-0.5 text-caption font-bold text-ink tabular-nums">
                        {clockOfSeconds(note.atSeconds)}
                      </button>
                    ) : null}
                    <p className="text-body-sm leading-6 whitespace-pre-wrap text-ink">{note.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-slate">{t('noNotes')}</p>
            )
          ) : published.transcript ? (
            <p className="max-h-96 overflow-y-auto rounded-3xl border border-fog-light bg-white p-5 text-body-sm leading-6 whitespace-pre-wrap text-ink">{published.transcript}</p>
          ) : (
            <p className="text-body-sm text-slate">{t('noTranscript')}</p>
          )}
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-110 lg:shrink-0">
          {published.steps.length ? <Steps id={data.id} steps={published.steps} /> : null}
          <section aria-labelledby="and-now" className="flex flex-col gap-3 rounded-3xl bg-navy-deep p-6 text-white max-sm:hidden">
            <p className={cn(LABEL_CLASS, 'text-rose')}>{t('andNow')}</p>
            <h2 id="and-now" className="font-heading text-h4 font-bold">
              {t('accompanyTitle')}
            </h2>
            <p className="text-body-sm leading-5 text-white/80">{t('accompanyLead')}</p>
            <Link href="/services/accompagnement" className={cn('mt-1 flex h-12 items-center justify-center rounded-full bg-rouge font-heading text-body-sm font-bold text-white hover:bg-crimson', PRESS)}>
              {t('accompanyCta')}
            </Link>
          </section>
          {data.payment ? <InvoiceCard payment={data.payment} /> : null}
        </aside>
      </div>
      {/* Phone: « Et maintenant ? » stays at the bottom, in reach. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-fog-light bg-white px-5 pt-4 sm:hidden"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-label text-label font-bold tracking-wide text-rouge uppercase">{t('andNow')}</span>
          <span className="truncate text-body-sm font-bold text-navy-deep">{t('phoneAccompany')}</span>
        </div>
        <Link href="/services/accompagnement" className={cn('flex h-12 shrink-0 items-center rounded-full bg-rouge px-6 font-heading text-body-sm font-bold text-white', PRESS)}>
          {t('phoneCta')}
        </Link>
      </div>
    </>
  );
}

/** « Vos prochaines étapes »: the Client ticks them; Stanzy sees it on his side. */
function Steps({ id, steps }: { id: string; steps: Published['steps'] }): ReactNode {
  const t = useTranslations('Consultation.space.after');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toggle = useMutation(
    trpc.consultationSpace.toggleStep.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationSpace.pathKey() });
        toast.add({ title: result.done ? t('stepDone') : t('stepUndone'), type: 'success' });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  const done = steps.filter((s) => s.doneAt).length;
  return (
    <section aria-labelledby="next-steps" className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="next-steps" className="font-heading text-h4 font-bold text-navy-deep">
          {t('steps')}
        </h2>
        <span className="text-caption font-semibold text-slate">{t('stepsProgress', { done, total: steps.length })}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {steps.map((step) => (
          <li key={step.id}>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(step.doneAt)}
                disabled={toggle.isPending}
                onChange={(e) => toggle.mutate({ id, stepId: step.id, done: e.target.checked })}
                className="size-5 shrink-0 accent-leaf"
              />
              <span className={cn('text-body-sm text-ink line-through decoration-transparent transition-colors delay-150 duration-150 ease-out', step.doneAt && 'text-slate decoration-slate')}>{step.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
