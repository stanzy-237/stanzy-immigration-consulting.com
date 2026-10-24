'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { drawTypeKey } from '@/features/draws/lib/draw-type';
import type { DrawText } from '@/features/draws/lib/draws-table';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/** Noon UTC, so the calendar day is the same in every time zone. */
const day = (draw: DrawSummary) => new Date(`${draw.date}T12:00:00Z`);

/**
 * How a Tirage reads on this page: its type in French on /fr (IRCC's own
 * English name otherwise, or for a type we don't know) and its date as
 * "16 oct. 2026".
 */
export function useDrawText(): DrawText {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations('Draws.types');
  return useMemo(
    () => ({
      type: (draw: DrawSummary) => {
        const key = locale === 'fr' ? drawTypeKey(draw.typeLabel) : null;
        return key && t.has(key) ? t(key) : draw.typeLabel;
      },
      date: (draw: DrawSummary) => format.dateTime(day(draw), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      shortDate: (draw: DrawSummary) => format.dateTime(day(draw), { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    }),
    [locale, format, t],
  );
}
