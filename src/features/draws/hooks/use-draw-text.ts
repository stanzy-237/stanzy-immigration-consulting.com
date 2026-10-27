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
 * English name otherwise, or for a type we don't know), or in short; its date
 * as "16 oct. 2026"; and its tie-breaking rule in UTC.
 */
export function useDrawText(): DrawText {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations('Draws.types');
  const tShort = useTranslations('Draws.typesShort');
  const tDraws = useTranslations('Draws');
  return useMemo(
    () => ({
      type: (draw: DrawSummary) => {
        const key = locale === 'fr' ? drawTypeKey(draw.typeLabel) : null;
        return key && t.has(key) ? t(key) : draw.typeLabel;
      },
      date: (draw: DrawSummary) => format.dateTime(day(draw), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      shortDate: (draw: DrawSummary) => format.dateTime(day(draw), { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      shortType: (draw: DrawSummary) => {
        const key = drawTypeKey(draw.typeLabel);
        return key && tShort.has(key) ? tShort(key) : draw.typeLabel;
      },
      tieBreak: (draw: DrawSummary) => {
        if (!draw.tieBreakAt) return null;
        const at = new Date(draw.tieBreakAt);
        return tDraws('tieBreakValue', {
          date: format.dateTime(at, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
          time: format.dateTime(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }),
        });
      },
    }),
    [locale, format, t, tShort, tDraws],
  );
}
