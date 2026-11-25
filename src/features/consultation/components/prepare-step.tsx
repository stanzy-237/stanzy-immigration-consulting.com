'use client';

import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ArrowRight, ArrowUpRight, BarChart3, Check, FileText, Plus, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import type { BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { SITUATION_MAX } from '@/features/consultation/lib/booking';
import { TOPIC_KEYS, type TopicKey } from '@/features/consultation/lib/booking-fields';
import { PRESS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

export type Answers = { topics: string[]; crsScore: number | null; itaReceived: boolean | null; situation: string | null };

const ICONS: Record<TopicKey, typeof ShieldCheck> = { eligibility: ShieldCheck, points: BarChart3, documents: FileText, next: ArrowRight };

const label = 'text-body-sm leading-5 font-semibold text-ink';

/**
 * Step 2, Préparer l'échange: what to talk about, the CRS score, an ITA,
 * a few lines on their situation. All optional; Stanzy reads them before the
 * Réunion. Topics: cards with icons on mobile, chips on desktop; their check
 * fades in from scale 0.9 (row « Topic chips »).
 */
export function PrepareStep({
  booking,
  initial,
  onSaved,
  onExpired,
}: {
  booking: BookingRef;
  initial: Answers;
  onSaved: () => void;
  onExpired: () => void;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.prepare');
  const tToast = useTranslations('Consultation.reservation.toast');
  const trpc = useTRPC();
  const id = useId();
  const [topics, setTopics] = useState<string[]>(initial.topics);
  const [crs, setCrs] = useState(initial.crsScore?.toString() ?? '');
  const [ita, setIta] = useState<boolean | null>(initial.itaReceived);
  const [situation, setSituation] = useState(initial.situation ?? '');
  const [writing, setWriting] = useState(Boolean(initial.situation));

  const save = useMutation(
    trpc.consultation.prepare.mutationOptions({
      onSuccess: () => {
        toast.add({ title: tToast('saved'), type: 'success' });
        onSaved();
      },
      onError: (failure) => {
        if (failure instanceof TRPCClientError && failure.message === 'HOLD_EXPIRED') onExpired();
        else toast.add({ title: tToast('error'), type: 'error' });
      },
    }),
  );

  const toggle = (topic: string) => setTopics((all) => (all.includes(topic) ? all.filter((x) => x !== topic) : [...all, topic]));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const score = Number.parseInt(crs, 10);
    save.mutate({
      ...booking,
      answers: {
        topics: topics as TopicKey[],
        crsScore: Number.isFinite(score) && score >= 0 && score <= 1200 ? score : null,
        itaReceived: ita,
        situation: situation.trim() || null,
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 lg:-mt-5 lg:pl-11.5">
        <h2 className="font-heading text-h3 leading-8.5 font-extrabold tracking-tight text-ink lg:hidden">{t('mobileTitle')}</h2>
        <p className="text-body leading-6 text-slate lg:text-body-sm lg:leading-5">{t('lead')}</p>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className={cn(label, 'mb-2.5')}>{t('topics')}</legend>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
          {TOPIC_KEYS.map((topic) => {
            const on = topics.includes(topic);
            const Icon = ICONS[topic];
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(topic)}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left text-body-sm leading-5 font-semibold lg:flex-row lg:items-center lg:gap-2 lg:rounded-full lg:px-4 lg:py-2.5',
                  PRESS,
                  on ? 'border-2 border-rouge bg-blush text-ink lg:text-rouge' : 'border-fog text-ink hover:border-slate-mute',
                )}
              >
                <Icon aria-hidden={true} className={cn('size-5 lg:hidden', on ? 'text-rouge' : 'text-ink')} strokeWidth={2} />
                <AnimatePresence initial={false}>
                  {on ? (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-3 right-3 flex size-5.5 items-center justify-center rounded-full bg-rouge lg:static lg:size-auto lg:bg-transparent"
                    >
                      <Check aria-hidden={true} className="size-3.5 text-white lg:text-rouge" strokeWidth={3} />
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                {t(`topic.${topic}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-start gap-3 lg:gap-4">
        <div className="flex w-30 shrink-0 flex-col gap-2 lg:w-55">
          <label htmlFor={`${id}-crs`} className={label}>
            <span className="lg:hidden">{t('crsMobile')}</span>
            <span className="hidden lg:inline">{t('crs')}</span>
          </label>
          <input
            id={`${id}-crs`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={crs}
            onChange={(e) => setCrs(e.target.value.replace(/\D/g, ''))}
            className="h-14 rounded-xl border border-fog bg-white px-4 text-center font-heading text-h4 font-bold text-ink outline-none focus:border-2 focus:border-navy-deep lg:h-12 lg:rounded-lg lg:text-left lg:font-body lg:text-body lg:font-normal"
          />
          {/* Flowing text, so a narrow column wraps between words, never inside the link. */}
          <p className="text-caption leading-4 text-slate">
            {t('noScore')}{' '}
            <Link href="/outils/crs" target="_blank" className="inline-flex items-center gap-0.5 font-semibold whitespace-nowrap text-ink underline underline-offset-2">
              <span className="lg:hidden">{t('calculatorMobile')}</span>
              <span className="hidden lg:inline">{t('calculator')}</span>
              <ArrowUpRight aria-hidden={true} className="hidden size-3 lg:block" strokeWidth={2.2} />
            </Link>
          </p>
        </div>

        <fieldset className="flex flex-1 flex-col gap-2">
          <legend className={cn(label, 'mb-2')}>
            <span className="lg:hidden">{t('selectedMobile')}</span>
            <span className="hidden lg:inline">{t('selected')}</span>
          </legend>
          {/* Mobile: a segmented control; desktop: two radio cards. */}
          <div className="flex h-14 gap-1 rounded-xl bg-ice-blue p-1 lg:h-12 lg:gap-2 lg:bg-transparent lg:p-0">
            {[false, true].map((value) => {
              const on = ita === value;
              return (
                <label
                  key={String(value)}
                  className={cn(
                    'flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-lg text-body-sm leading-5 font-semibold transition-colors duration-150 ease-standard lg:justify-start lg:px-3.5',
                    on ? 'bg-white text-ink shadow-sm lg:border-2 lg:border-navy-deep lg:bg-ice-blue lg:shadow-none' : 'text-slate lg:border lg:border-fog lg:text-ink',
                  )}
                >
                  <input type="radio" name={`${id}-ita`} checked={on} onChange={() => setIta(value)} className="peer sr-only" />
                  <span
                    aria-hidden={true}
                    className={cn(
                      'hidden size-4.5 shrink-0 rounded-full bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep lg:block',
                      on ? 'border-5 border-navy-deep' : 'border-2 border-fog',
                    )}
                  />
                  <span className="lg:hidden">{value ? t('yesShort') : t('noShort')}</span>
                  <span className="hidden lg:inline">{value ? t('yes') : t('no')}</span>
                </label>
              );
            })}
          </div>
          <p className="hidden text-caption leading-4 text-slate lg:block">{t('itaHint')}</p>
        </fieldset>
      </div>

      {/* Mobile: the situation behind « Ajouter un mot »; desktop: always open. */}
      {!writing ? (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className={cn('flex items-center gap-2.5 rounded-xl border border-dashed border-fog px-4 py-4 text-body-sm font-semibold text-ink lg:hidden', PRESS)}
        >
          <Plus aria-hidden={true} className="size-4" strokeWidth={2.5} />
          {t('addSituation')}
        </button>
      ) : null}
      <div className={cn('flex-col gap-2', writing ? 'flex' : 'hidden lg:flex')}>
        <label htmlFor={`${id}-situation`} className={label}>
          {t('situation')}
        </label>
        <textarea
          id={`${id}-situation`}
          rows={3}
          maxLength={SITUATION_MAX}
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          aria-describedby={`${id}-count`}
          className="min-h-28 resize-y rounded-lg border border-fog bg-white px-4 py-3.5 text-body leading-6 text-ink outline-none focus:border-2 focus:border-navy-deep"
        />
        <p id={`${id}-count`} className="text-right text-caption leading-4 text-slate tabular-nums">
          {t('count', { count: situation.length, max: SITUATION_MAX })}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-2 lg:mt-0 lg:flex-row lg:justify-end lg:pt-0">
        <button
          type="submit"
          disabled={save.isPending}
          className={cn('flex h-14 items-center justify-center rounded-full bg-navy-deep px-7 font-heading text-body font-bold text-white disabled:opacity-60 lg:h-12', PRESS)}
        >
          <span className="lg:hidden">{t('submitMobile')}</span>
          <span className="hidden lg:inline">{t('submit')}</span>
        </button>
        <button type="button" onClick={onSaved} className="text-center text-body-sm leading-5 text-slate lg:hidden">
          {t('skip')}
        </button>
      </div>
    </form>
  );
}

/** The done step's line: « Score CRS 452 · pas encore sélectionné · Admissibilité, Gagner des points CRS ». */
export function useAnswersSummary(answers: Answers): string {
  const t = useTranslations('Consultation.reservation.prepare');
  const parts = [
    answers.crsScore === null ? null : t('crsSummary', { score: answers.crsScore }),
    answers.itaReceived === null ? null : answers.itaReceived ? t('itaSummaryYes') : t('itaSummaryNo'),
    answers.topics.length ? answers.topics.map((topic) => t(`topic.${topic as TopicKey}`)).join(', ') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('nothing');
}
