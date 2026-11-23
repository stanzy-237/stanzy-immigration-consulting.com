'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useInView, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, type ReactNode } from 'react';

import { firstFreeStart } from '@/features/consultation/contexts/chosen-slot-context';
import { bookingHref, slotDay, timeOf } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/**
 * « On en parle de vive voix ? » (desktop): the next free slot, live from the
 * same query as the panel, and a button to book it. Stanzy waves once when the
 * band reaches the viewport. Hidden when nothing is free. On mobile the sticky
 * booking bar does this job.
 */
export function BookingInvite(): ReactNode {
  const t = useTranslations('Consultation.page.invite');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultation.slots.queryOptions());
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const reduce = useReducedMotion();
  const start = firstFreeStart(data.days);
  if (!start) return null;

  return (
    <section aria-labelledby="consultation-invite" className="hidden bg-off-white px-7 pb-24 lg:block">
      <div
        ref={ref}
        className="relative mx-auto flex max-w-7xl items-center justify-between gap-10 overflow-hidden rounded-3xl bg-rouge py-12 pr-14 pl-60"
      >
        <div aria-hidden={true} className="absolute -bottom-75 -left-15 size-95 rounded-full bg-navy-deep" />
        {/* The sprite starts when it loads: it is only asked for once the band is in view. */}
        <Image
          unoptimized={true}
          src={inView && !reduce ? '/stanzy/wave-once.svg' : '/stanzy/wave.svg'}
          alt=""
          width={150}
          height={262}
          className="absolute -bottom-16 left-14 h-65.5 w-37.5"
        />
        <div className="relative flex flex-col gap-2 text-white">
          <h2 id="consultation-invite" className="font-heading text-4xl leading-10 font-extrabold tracking-tight">
            {t('title')}
          </h2>
          <p className="text-body-lg leading-6.5 opacity-90">
            {t.rich('next', {
              slot: `${slotDay(start, locale)} ${t('at')} ${timeOf(start, locale)}`,
              b: (chunks) => <span className="font-bold">{chunks}</span>,
            })}
          </p>
        </div>
        <Link
          href={bookingHref(start)}
          className={cn(
            'relative flex h-14 shrink-0 items-center gap-2.5 rounded-full bg-white px-7 font-heading text-body-sm font-bold text-rouge hover:bg-blush',
            PRESS,
          )}
        >
          {t('cta')}
          <ArrowRight aria-hidden={true} className="size-4.5" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}
