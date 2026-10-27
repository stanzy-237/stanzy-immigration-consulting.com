'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { windowDays, type GroupPrediction } from '@/features/draw-prediction/lib/predict-next-draws';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';

/**
 * How a Prédiction de tirage reads: its group in short (« PCP »), its window
 * (« entre le 3 et le 6 nov. »), its score range, the one-paragraph « why »
 * worded from the inputs the prediction carries, and the data behind it.
 */
export function usePredictionText() {
  const t = useTranslations('DrawPrediction');
  const tGroups = useTranslations('Draws.groups');
  const format = useFormatter();
  const text = useDrawText();

  return useMemo(() => {
    const dayMonth = (date: Date) => format.dateTime(date, { day: 'numeric', month: 'short', timeZone: 'UTC' });

    return {
      group: (p: GroupPrediction) => tGroups(p.group),
      window: (p: GroupPrediction) => {
        const { start, end, span } = windowDays(p);
        return t('window', {
          span,
          start: dayMonth(start),
          startDay: format.dateTime(start, { day: 'numeric', timeZone: 'UTC' }),
          end: dayMonth(end),
        });
      },
      range: (p: GroupPrediction) => `${p.scores.min}–${p.scores.max}`,
      median: (p: GroupPrediction) => t('featured.median', { median: p.scores.median }),
      why: (p: GroupPrediction) => {
        const group = tGroups(p.group);
        const date = text.shortDate(p.lastDraw);
        const sentences = [
          p.fallback ? t('explain.single', { group, date, days: p.gapDays }) : t('explain.cadence', { group, date, days: p.gapDays }),
        ];
        if (p.overdue) sentences.push(t('explain.overdue'));
        if (p.category) {
          const { draw, count, of } = p.category;
          const type = text.shortType(draw);
          sentences.push(
            count === 1
              ? t('explain.categoryLatest', { type })
              : count === of
                ? t('explain.categoryAll', { type, of })
                : t('explain.categorySome', { type, count, of }),
          );
        }
        return sentences.join(' ');
      },
      data: (p: GroupPrediction) =>
        t('data', {
          count: p.countInYear,
          scores: p.scores.last.length,
          list: p.scores.last.map((score) => format.number(score)).join(', '),
        }),
    };
  }, [t, tGroups, format, text]);
}
