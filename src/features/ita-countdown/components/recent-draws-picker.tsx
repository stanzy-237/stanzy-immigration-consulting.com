'use client';

import { ChevronDown, Clock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { utcDate } from '@/features/ita-countdown/lib/ita-deadline';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';

/** How many recent Tirages the shortcut offers. */
const DRAWS_SHOWN = 6;

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
  const [open, setOpen] = useState(false);
  const { data } = api.draws.latest.useQuery({ take: DRAWS_SHOWN });
  const draws = data?.draws ?? [];

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
          className="order-last mt-2 flex basis-full flex-col gap-1.5"
        >
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
