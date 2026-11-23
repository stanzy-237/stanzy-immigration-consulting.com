'use client';

import { useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { BookingCard } from '@/features/consultation/components/booking-panel';
import { ConsultationFaq } from '@/features/consultation/components/consultation-faq';
import { ConsultationTopics } from '@/features/consultation/components/consultation-topics';
import { DEFAULT_AVAILABILITY } from '@/features/consultation/lib/availability';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** A figure under the hero or a client's words: real ones only, written in `messages/*.json`. */
type Stat = { value: string; label: string };
type Review = { quote: string; author: string };

const STEPS = ['before', 'during', 'after'] as const;
const DELIVERABLES = ['plan', 'recording', 'documents'] as const;

const label = 'font-label text-label leading-3.5 font-bold tracking-wide uppercase';
const sectionTitle = 'font-heading text-h3 leading-8 font-extrabold tracking-tight text-ink lg:text-h2 lg:leading-11';

/**
 * The public Consultation page (#15): what it is, the free slots to book one,
 * how it goes, what it covers and what one leaves with. Sections reveal once
 * as they scroll in; the hero is static.
 */
export function ConsultationView(): ReactNode {
  const t = useTranslations('Consultation.page');
  const trpc = useTRPC();
  // Prefetched by the route; the copy falls back to the default length if it failed.
  const { data } = useQuery(trpc.consultation.slots.queryOptions());
  const minutes = data?.durationMinutes ?? DEFAULT_AVAILABILITY.durationMinutes;
  const moveCutoffHours = data?.moveCutoffHours ?? DEFAULT_AVAILABILITY.moveCutoffHours;
  const stats = t.raw('hero.stats') as Stat[];
  const reviews = t.raw('reviews.items') as Review[];

  return (
    <MotionConfig reducedMotion="user">
      <SiteNav />
      <main className="overflow-hidden bg-white">
        {/* Hero: on desktop the slots sit beside the copy; on mobile they follow it, over the navy's edge. */}
        <section aria-labelledby="consultation-title" className="lg:bg-navy-deep lg:px-7 lg:pt-20 lg:pb-22">
          <div className="mx-auto max-w-7xl lg:flex lg:items-center lg:gap-16">
            <div className="flex flex-col gap-4.5 bg-navy-deep px-5 pt-10 pb-2 lg:flex-1 lg:gap-6 lg:bg-transparent lg:p-0">
              <p className={cn(label, 'self-start rounded-full bg-white/10 px-3 py-2 text-rose lg:px-3.5')}>
                <span className="hidden lg:inline">{t('hero.section')} · </span>
                {t('hero.pill', { minutes })}
              </p>
              <h1
                id="consultation-title"
                className="font-heading text-[clamp(34px,4.6vw,56px)] leading-tight font-extrabold tracking-tight text-white lg:leading-none"
              >
                {t('hero.title')}
              </h1>
              <p className="max-w-136 text-body leading-6 text-ice-blue lg:text-body-lg lg:leading-7">{t('hero.lead', { minutes })}</p>
              <dl className="flex max-w-136 gap-5 border-t border-white/15 pt-4.5 lg:gap-12 lg:pt-6">
                {[...stats, { value: t('hero.duration', { minutes }), label: t('hero.durationLabel') }].map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse gap-0.5 lg:gap-1">
                    <dt className="text-caption text-fog lg:text-body-sm lg:leading-5">{stat.label}</dt>
                    <dd className="font-heading text-h4 leading-6 font-extrabold text-white lg:text-h3 lg:leading-8">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative px-4 pb-12 lg:w-130 lg:shrink-0 lg:p-0">
              <div aria-hidden={true} className="absolute inset-x-0 top-0 h-18 bg-navy-deep lg:hidden" />
              <BookingCard className="relative" />
            </div>
          </div>
        </section>

        {/* Avant · Pendant · Après */}
        <section aria-labelledby="consultation-steps" className="bg-ice-blue px-5 py-14 md:px-7 lg:py-22">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
            <Reveal>
              <h2 id="consultation-steps" className={sectionTitle}>
                {t('steps.title')}
              </h2>
            </Reveal>
            <ol className="grid gap-4 lg:grid-cols-3 lg:gap-6">
              {STEPS.map((step, index) => {
                const after = step === 'after';
                return (
                  <li key={step}>
                    <Reveal
                      delay={index * 0.06}
                      className={cn('flex h-full flex-col gap-3.5 rounded-2xl p-6 lg:p-7', after ? 'bg-navy-deep' : 'bg-white')}
                    >
                      <p className={cn(label, after ? 'text-rose' : 'text-rouge')}>{t(`steps.${step}.eyebrow`)}</p>
                      <h3 className={cn('font-heading text-h4 leading-6.5 font-bold', after ? 'text-white' : 'text-ink')}>
                        {t(`steps.${step}.title`, { minutes })}
                      </h3>
                      <p className={cn('text-body leading-6', after ? 'text-ice-blue' : 'text-slate')}>{t(`steps.${step}.body`)}</p>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <ConsultationTopics />

        {/* Ce que vous repartez avec */}
        <section aria-labelledby="consultation-deliverables" className="bg-off-white px-5 py-14 md:px-7 lg:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
            <h2 id="consultation-deliverables" className={cn(label, 'text-slate')}>
              {t('deliverables.eyebrow')}
            </h2>
            <ol className="grid gap-8 lg:grid-cols-3 lg:gap-14">
              {DELIVERABLES.map((item, index) => (
                <li key={item}>
                  <Reveal delay={index * 0.06} className="flex gap-4 lg:flex-col">
                    <span aria-hidden={true} className="w-8 shrink-0 font-heading text-h3 leading-8 font-extrabold text-rouge lg:w-auto lg:text-h1 lg:leading-14">
                      {index + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5 lg:gap-4">
                      <h3 className="font-heading text-h4 leading-6 font-bold tracking-tight text-ink lg:text-h3 lg:leading-8.5">
                        {t(`deliverables.${item}.title`)}
                      </h3>
                      <p className="text-body-sm leading-5 text-slate lg:text-body lg:leading-6">{t(`deliverables.${item}.body`)}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ils en parlent: shown once real words are written in the messages. */}
        {reviews.length > 0 ? (
          <section aria-labelledby="consultation-reviews" className="bg-white py-14 pl-5 md:px-7 lg:pt-22 lg:pb-24">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:gap-10">
              <Reveal>
                <h2 id="consultation-reviews" className={sectionTitle}>
                  {t('reviews.title')}
                </h2>
              </Reveal>
              <ul className="flex gap-3 overflow-x-auto pr-5 lg:gap-12 lg:overflow-visible lg:pr-0">
                {reviews.map((review, index) => (
                  <li key={review.quote} className="w-75 shrink-0 lg:w-auto lg:flex-1">
                    <Reveal
                      delay={index * 0.06}
                      className={cn(
                        'flex h-full flex-col gap-4 rounded-2xl border border-fog-light p-5.5 lg:gap-5 lg:rounded-none lg:border-0 lg:border-l-3 lg:py-0 lg:pr-0 lg:pl-6',
                        index === 0 ? 'border-l-3 border-l-rouge lg:border-l-rouge' : 'lg:border-l-fog',
                      )}
                    >
                      <blockquote className="text-body leading-6 text-ink lg:text-body-lg lg:leading-7">{review.quote}</blockquote>
                      <p className="font-label text-body-sm leading-5 font-bold text-slate">{review.author}</p>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <ConsultationFaq moveCutoffHours={moveCutoffHours} />
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
