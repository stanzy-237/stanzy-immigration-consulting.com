'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingCard } from '@/features/consultation/components/booking-card';
import { CallPreview } from '@/features/consultation/components/call-preview';
import { ConsultationJourney } from '@/features/consultation/components/consultation-journey';
import { ConsultationFaq } from '@/features/consultation/components/consultation-faq';
import { ConsultationTopics } from '@/features/consultation/components/consultation-topics';
import { RecapPreview } from '@/features/consultation/components/recap-preview';
import { LABEL_CLASS, SECTION_TITLE_CLASS } from '@/features/consultation/lib/styles';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** A client's words: real ones only, written in `messages/*.json`. */
type Review = { quote: string; author: string };

const DELIVERABLES = ['plan', 'recording', 'documents'] as const;

/**
 * The public Consultation page (#15): what it is, the free slots to book one,
 * how it goes, what it covers and what one leaves with. Sections reveal once
 * as they scroll in; the hero is static. The route prefetches the slots, so
 * the page's shape only shows if they must be fetched again.
 */
export function ConsultationView(): ReactNode {
  return (
    <MotionConfig reducedMotion="user">
      <SiteNav />
      <QueryBoundary fallback={<ConsultationPageSkeleton />}>
        <ConsultationPage />
      </QueryBoundary>
      <SiteFooter />
    </MotionConfig>
  );
}

function ConsultationPage(): ReactNode {
  const t = useTranslations('Consultation.page');
  const trpc = useTRPC();
  // The length and the move cutoff are the consultant's Disponibilités, read with the slots.
  const { data } = useSuspenseQuery(trpc.consultation.slots.queryOptions());
  const { durationMinutes: minutes, moveCutoffHours } = data;
  const reviews = t.raw('reviews.items') as Review[];

  return (
    <main className="overflow-hidden bg-white">
      {/* Hero: on desktop the slots sit beside the copy; on mobile they follow it, over the navy's edge. */}
      <section aria-labelledby="consultation-title" className="lg:bg-navy-deep lg:px-7 lg:pt-20 lg:pb-22">
        <div className="mx-auto max-w-7xl lg:flex lg:items-center lg:gap-16">
          <div className="flex flex-col gap-4.5 bg-navy-deep px-5 pt-10 pb-2 lg:flex-1 lg:gap-6 lg:bg-transparent lg:p-0">
            <p className={cn(LABEL_CLASS, 'self-start rounded-full bg-white/10 px-3 py-2 text-rose lg:px-3.5')}>
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
            <CallPreview className="lg:w-140" />
          </div>
          <div className="relative px-4 pb-12 lg:w-130 lg:shrink-0 lg:p-0">
            <div aria-hidden={true} className="absolute inset-x-0 top-0 h-18 bg-navy-deep lg:hidden" />
            <BookingCard className="relative" />
          </div>
        </div>
      </section>

      <ConsultationJourney minutes={minutes} />

      <ConsultationTopics />

      <RecapPreview />

      {/* Ce que vous repartez avec */}
      <section aria-labelledby="consultation-deliverables" className="bg-off-white px-5 py-14 md:px-7 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
          <h2 id="consultation-deliverables" className={cn(LABEL_CLASS, 'text-slate')}>
            {t('deliverables.eyebrow')}
          </h2>
          <ol className="grid gap-8 lg:grid-cols-3 lg:gap-14">
            {DELIVERABLES.map((item, index) => (
              <li key={item}>
                <Reveal delay={index * 0.06} className="flex gap-4 lg:flex-col">
                  <span
                    aria-hidden={true}
                    className="w-8 shrink-0 font-heading text-h3 leading-8 font-extrabold text-rouge lg:w-auto lg:text-h1 lg:leading-14"
                  >
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
              <h2 id="consultation-reviews" className={SECTION_TITLE_CLASS}>
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
  );
}

/** The hero's shape: shown only when the prefetched slots must be fetched again. */
function ConsultationPageSkeleton(): ReactNode {
  const t = useTranslations('Consultation.page.booking');
  return (
    <main role="status" className="animate-skeleton-in bg-white">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="lg:bg-navy-deep lg:px-7 lg:pt-20 lg:pb-22">
        <div className="mx-auto max-w-7xl lg:flex lg:items-center lg:gap-16">
          <div className="flex flex-col gap-4.5 bg-navy-deep px-5 pt-10 pb-6 lg:flex-1 lg:gap-6 lg:p-0">
            <Skeleton className="h-7 w-64 rounded-full bg-white/10" />
            <Skeleton className="h-28 w-full max-w-2xl bg-white/10 lg:h-44" />
            <Skeleton className="h-16 w-full max-w-136 bg-white/10" />
          </div>
          <div className="relative px-4 pb-12 lg:w-130 lg:shrink-0 lg:p-0">
            <div className="absolute inset-x-0 top-0 h-18 bg-navy-deep lg:hidden" />
            <Skeleton className="relative h-96 rounded-3xl bg-white" />
          </div>
        </div>
      </div>
    </main>
  );
}
