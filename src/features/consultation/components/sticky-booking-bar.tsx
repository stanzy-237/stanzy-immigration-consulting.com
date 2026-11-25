'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode, type RefObject } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';
import { firstFreeStart, useChosenSlot } from '@/features/consultation/contexts/chosen-slot-context';
import { bookingHref, fcfa, slotDay, timeOf } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/**
 * Mobile: once the slot panel (`panelRef`) is scrolled past, a bar slides up
 * with the chosen slot and « Réserver »; it slides back down when the panel
 * returns (docs/design/consultation-motion.md, row « Sticky booking bar »).
 * « Changer » scrolls back to the panel. Reduced motion: it fades.
 */
export function StickyBookingBar({ panelRef }: { panelRef: RefObject<HTMLElement | null> }): ReactNode {
  const t = useTranslations('Consultation.page.sticky');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultation.slots.queryOptions());
  const [chosen] = useChosenSlot();
  // Shown once the visitor has scrolled past the panel; not while it is still below.
  const [past, setPast] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', () => {
    const panel = panelRef.current?.getBoundingClientRect();
    setPast(Boolean(panel && panel.bottom < 0));
  });
  const reduce = useReducedMotion();
  const start = chosen ?? firstFreeStart(data.days);
  const shown = Boolean(start) && past;
  const hidden = reduce ? { opacity: 0 } : { y: '100%' };

  const meta =
    data.price === null
      ? t('meta', { minutes: data.durationMinutes })
      : t('metaPrice', { minutes: data.durationMinutes, price: fcfa(data.price, locale) });

  return (
    <AnimatePresence>
      {shown && start ? (
        <motion.div
          key="bar"
          initial={hidden}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={{ ...hidden, transition: { duration: 0.15, ease: 'easeIn' } }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-fog-light bg-white/90 pt-3 pr-4 pb-7.5 pl-5 shadow-lg shadow-navy-deep/10 backdrop-blur-lg lg:hidden"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-body leading-5 font-bold text-ink">
              {slotDay(start, locale, { short: true })} · {timeOf(start, locale)}
            </p>
            <p className="text-caption leading-4 text-slate">
              {meta} ·{' '}
              <button
                type="button"
                onClick={() => panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })}
                className="font-semibold text-rouge"
              >
                {t('change')}
              </button>
            </p>
          </div>
          <Link
            href={bookingHref(start)}
            className={cn(
              'flex h-12 shrink-0 items-center gap-2 rounded-full bg-rouge px-5.5 font-heading text-body-sm leading-5 font-bold text-white',
              PRESS,
            )}
          >
            {t('book')}
            <ArrowRight aria-hidden={true} className="size-4" strokeWidth={2.5} />
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
