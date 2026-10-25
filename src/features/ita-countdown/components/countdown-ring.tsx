'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { MapleLeaf } from '@/features/ita-countdown/components/maple-leaf';
import { ITA_WINDOW_DAYS, type TimeLeft } from '@/features/ita-countdown/lib/ita-deadline';
import { URGENCY_CLASSES, urgencyOf } from '@/features/ita-countdown/lib/urgency';
import { cn } from '@/lib/utils';

const RADIUS = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The ring that empties as the window closes, with the days left inside. */
export function CountdownRing({ left }: { left: TimeLeft | null }): ReactNode {
  const t = useTranslations('ItaCountdown');
  const colors = left ? URGENCY_CLASSES[urgencyOf(left.days)] : null;

  return (
    <div className="relative mx-auto grid size-56 place-items-center">
      <svg aria-hidden={true} viewBox="0 0 220 220" className="absolute inset-0 size-full -rotate-90">
        <circle cx="110" cy="110" r={RADIUS} fill="none" strokeWidth="8" className="stroke-ice-blue" />
        {left && !left.expired && (
          <circle
            cx="110"
            cy="110"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - left.share)}
            className={cn('transition-all duration-1000', colors?.stroke)}
          />
        )}
      </svg>

      {!left && (
        <div className="flex flex-col items-center">
          <MapleLeaf className="size-11 animate-pulse" />
          <strong className="mt-2 font-heading text-h3 font-bold leading-none text-navy-deep">{ITA_WINDOW_DAYS}</strong>
          <span className="mt-1 font-label uppercase tracking-widest text-slate">
            {t('ring.days', { days: ITA_WINDOW_DAYS })}
          </span>
        </div>
      )}
      {left && !left.expired && (
        <div role="timer" className="flex flex-col items-center">
          {/* Joined by hand: `cn` would drop the custom size `text-h2` next to a colour. */}
          <strong className={`font-heading text-h2 font-bold leading-none ${colors?.text ?? ''}`}>{left.days}</strong>
          <span className="mt-1 font-label uppercase tracking-widest text-slate">{t('ring.days', { days: left.days })}</span>
          <span className="mt-1 text-caption text-slate">{t('ring.left')}</span>
        </div>
      )}
      {left?.expired && (
        <div className="flex flex-col items-center">
          <TriangleAlert aria-hidden={true} className="mb-2 size-8 text-rouge" />
          <span className="font-label uppercase tracking-widest text-slate">{t('ring.expired')}</span>
        </div>
      )}
    </div>
  );
}
