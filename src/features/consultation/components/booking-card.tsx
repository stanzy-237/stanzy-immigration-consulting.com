'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { bookingHref, dayLabels, fcfa, timeOf } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/**
 * « Choisissez votre créneau »: the free days and times (heure de Douala),
 * and « Réserver » to the booking step with the chosen start. The card and
 * its title show at once; the slots load under a skeleton.
 */
export function BookingCard({ className }: { className?: string }): ReactNode {
  const t = useTranslations('Consultation.page.booking');
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-4.5 rounded-3xl bg-white p-5 shadow-xl shadow-navy-deep/20 sm:gap-5 sm:p-7', className)}
    >
      <h2 id={titleId} className="font-heading text-body-lg leading-6 font-bold text-ink sm:text-h4">
        {t('title')}
      </h2>
      <QueryBoundary fallback={<BookingPanelSkeleton />}>
        <BookingPanel />
      </QueryBoundary>
    </section>
  );
}

function BookingPanel(): ReactNode {
  const t = useTranslations('Consultation.page.booking');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultation.slots.queryOptions());
  const pageSize = useIsMobile() ? 4 : 5;

  const { days, durationMinutes, price } = data;
  const firstOpen = Math.max(0, days.findIndex((d) => d.starts.length > 0));
  const [dayIndex, setDayIndex] = useState(firstOpen);
  const [start, setStart] = useState<string | undefined>(days[firstOpen]?.starts[0]);
  // Until the visitor pages, show the page holding the chosen day (the page size settles after hydration).
  const [paged, setPaged] = useState<number | null>(null);
  const pageStart = paged ?? Math.floor(dayIndex / pageSize) * pageSize;

  const subtitle =
    price === null
      ? t('subtitle', { minutes: durationMinutes })
      : t('subtitlePrice', { minutes: durationMinutes, price: fcfa(price, locale) });

  if (!days.some((d) => d.starts.length > 0)) {
    return (
      <>
        <p className="-mt-3 text-caption text-slate sm:text-body-sm">{subtitle}</p>
        <p className="rounded-2xl bg-ice-blue px-5 py-4 text-body-sm leading-5 text-ink">{t('none')}</p>
      </>
    );
  }

  const day = days[dayIndex]!;
  const labels = dayLabels(day.day, locale);
  const visible = days.slice(pageStart, pageStart + pageSize);
  const choose = (index: number) => {
    setDayIndex(index);
    setStart(days[index]!.starts[0]);
  };
  const step = (direction: -1 | 1) => setPaged(Math.max(0, pageStart + direction * pageSize));

  return (
    <>
      <p className="-mt-3 text-caption text-slate sm:text-body-sm">{subtitle}</p>

      <div className="flex gap-1.5 sm:gap-2">
        {pageStart > 0 ? (
          <button
            type="button"
            aria-label={t('earlier')}
            onClick={() => step(-1)}
            className={cn('flex w-9 shrink-0 items-center justify-center rounded-lg bg-ice-blue text-ink sm:w-11', PRESS)}
          >
            <ChevronLeft aria-hidden={true} className="size-4 sm:size-4.5" strokeWidth={2.5} />
          </button>
        ) : null}
        <div role="radiogroup" aria-label={t('days')} className="flex flex-1 gap-1.5 sm:gap-2">
          {visible.map((slotDay, offset) => {
            const index = pageStart + offset;
            const { weekday, date, long } = dayLabels(slotDay.day, locale);
            const full = slotDay.starts.length === 0;
            const selected = index === dayIndex;
            return (
              <button
                key={slotDay.day}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={full ? t('full', { day: long }) : long}
                disabled={full}
                onClick={() => choose(index)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2.5 sm:gap-1 sm:py-3',
                  selected
                    ? 'bg-navy-deep'
                    : full
                      ? 'border border-dashed border-fog'
                      : cn('border border-fog-light hover:border-fog', PRESS),
                )}
              >
                <span
                  className={cn(
                    'font-label text-label font-semibold capitalize sm:text-caption',
                    selected ? 'text-fog' : full ? 'text-slate-mute' : 'text-slate',
                  )}
                >
                  {weekday}
                </span>
                <span
                  className={cn(
                    'font-heading text-body-lg leading-snug font-bold sm:text-h4 sm:leading-6',
                    selected ? 'text-white' : full ? 'text-slate-mute line-through' : 'text-ink',
                  )}
                >
                  {date}
                </span>
              </button>
            );
          })}
        </div>
        {pageStart + pageSize < days.length ? (
          <button
            type="button"
            aria-label={t('later')}
            onClick={() => step(1)}
            className={cn('flex w-9 shrink-0 items-center justify-center rounded-lg bg-ice-blue text-ink sm:w-11', PRESS)}
          >
            <ChevronRight aria-hidden={true} className="size-4 sm:size-4.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:gap-2.5">
        <p className={cn(LABEL_CLASS, 'text-slate')}>{labels.long}</p>
        <div role="radiogroup" aria-label={t('times')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {day.starts.map((iso) => {
            const selected = iso === start;
            return (
              <button
                key={iso}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStart(iso)}
                className={cn(
                  'rounded-full border py-3 text-body-sm leading-5',
                  PRESS,
                  selected
                    ? 'border-rouge bg-blush font-bold text-rouge ring-1 ring-rouge ring-inset'
                    : 'border-fog font-semibold text-ink hover:border-slate-mute',
                )}
              >
                {timeOf(iso, locale)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1 sm:gap-3">
        {start ? (
          <Link
            href={bookingHref(start)}
            className={cn(
              'flex h-13 items-center justify-center gap-2.5 rounded-full bg-rouge font-heading text-body font-bold text-white hover:bg-crimson',
              PRESS,
            )}
          >
            {t('book', { weekday: labels.weekday, day: labels.date, time: timeOf(start, locale) })}
            <ArrowRight aria-hidden={true} className="size-4.5" strokeWidth={2.5} />
          </Link>
        ) : null}
        <p className="text-center text-caption text-slate">{t('hold')}</p>
      </div>
    </>
  );
}

/** The panel's shape while the free slots load. */
function BookingPanelSkeleton(): ReactNode {
  const t = useTranslations('Consultation.page.booking');
  return (
    <div role="status" className="flex animate-skeleton-in flex-col gap-4.5 sm:gap-5">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="-mt-3 h-4 w-56" />
      <div aria-hidden={true} className="flex gap-1.5 sm:gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className={cn('h-14 flex-1 rounded-lg sm:h-16', i === 4 && 'hidden sm:block')} />
        ))}
      </div>
      <div aria-hidden={true} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 rounded-full" />
        ))}
      </div>
      <Skeleton aria-hidden={true} className="h-13 rounded-full" />
    </div>
  );
}
