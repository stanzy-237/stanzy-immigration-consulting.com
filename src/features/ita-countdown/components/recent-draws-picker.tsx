'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Clock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';
import { utcDate } from '@/features/ita-countdown/lib/ita-deadline';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** How many recent Tirages the shortcut offers (the route prefetches as many). */
const DRAWS_SHOWN = 5;

/**
 * « Derniers tirages »: ITAs go out on the day of a Tirage, so picking a
 * recent one fills the ITA date.
 */
export function RecentDrawsPicker({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (day: string) => void;
}): ReactNode {
  const t = useTranslations('ItaCountdown.draws');
  const format = useFormatter();
  const drawText = useDrawText();
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  // Not suspense: the list is behind a tap, so the form never waits for it.
  const { data, isPending } = useQuery(trpc.draws.latest.queryOptions({ take: DRAWS_SHOWN }));
  const draws = data?.draws ?? [];
  const tCommon = useTranslations('Common');

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ita-recent-draws"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border-2 border-fog-light bg-off-white px-3 text-caption font-semibold whitespace-nowrap text-navy-deep hover:bg-ice-blue"
      >
        <Clock aria-hidden={true} className="size-3.5 text-slate" />
        {t('button')}
        <ChevronDown aria-hidden={true} className={cn('size-3.5 text-slate transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          id="ita-recent-draws"
          role="listbox"
          aria-label={t('label')}
          aria-busy={isPending}
          className="order-last mt-2 flex basis-full flex-col gap-1.5"
        >
          {isPending && <span className="sr-only">{tCommon('loading')}</span>}
          {isPending &&
            [0, 1, 2].map((row) => <Skeleton key={row} aria-hidden={true} className="h-20 rounded-xl" />)}
          {draws.map((draw) => (
            <button
              key={draw.round}
              type="button"
              role="option"
              aria-selected={selected === draw.date}
              onClick={() => {
                onPick(draw.date);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2.5 rounded-xl border border-fog-light bg-off-white px-3.5 py-3 text-left hover:border-rouge hover:bg-blush',
                selected === draw.date && 'border-rouge bg-blush',
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body-sm font-medium text-navy-deep">
                  {t('item', {
                    round: draw.round,
                    date: format.dateTime(utcDate(draw.date), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }),
                  })}
                </span>
                <span className="text-caption font-medium text-steel-blue">{drawText.type(draw)}</span>
                <span className="text-caption text-slate">{t('crs', { crs: draw.crsMin })}</span>
              </span>
              <strong className="font-heading text-body-sm font-bold whitespace-nowrap text-rouge">
                {t('invitations', { count: format.number(draw.invitations) })}
              </strong>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
