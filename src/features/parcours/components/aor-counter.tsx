'use client';

import { useNow, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { calendarDuration, todayOf } from '@/features/parcours/lib/calendar-day';
import type { Etape } from '@/features/parcours/lib/etape-schema';

/**
 * « 4 mois et 12 jours depuis l’AOR — soit 134 jours », counted from the
 * latest AOR Étape; once a COPR Étape is dated on or after it, the frozen
 * total AOR → COPR. Nothing without an AOR Étape.
 *
 * `etapes` must be oldest first (same-day Étapes in creation order), so the
 * last match is the latest one.
 */
export function AorCounter({
  etapes,
  className,
  sentenceClassName,
}: {
  etapes: Etape[];
  className?: string;
  sentenceClassName: string;
}): ReactNode {
  const t = useTranslations('Parcours.aorCounter');
  const now = useNow();

  const aor = etapes.findLast((etape) => etape.code === 'AOR');
  if (!aor) return null;
  const copr = etapes.findLast((etape) => etape.code === 'COPR' && etape.date >= aor.date);
  const { months, days, totalDays } = calendarDuration(aor.date, copr?.date ?? todayOf(now));

  const duration =
    months === 0
      ? t('days', { days })
      : days === 0
        ? t('months', { months })
        : t('monthsAndDays', { months: t('months', { months }), days: t('days', { days }) });

  // One paragraph, so a screen reader reads the counter as one sentence.
  return (
    <p className={className}>
      <strong className={sentenceClassName}>{copr ? t('done', { duration }) : t('running', { duration })}</strong>{' '}
      <span className="mt-1 block text-body-sm text-slate">{t('total', { total: totalDays })}</span>
    </p>
  );
}
