'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { atNoon, type GroupPrediction } from '@/features/draw-prediction/lib/predict-next-draws';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';

/**
 * How a Prédiction de tirage reads: its group in short (« PCP »), when
 * (« probablement le lundi 9 novembre » or « semaine du 9 novembre, date
 * incertaine »), its score range, the one-paragraph « why » worded from the
 * inputs the prediction carries, how reliable it has been, and the data behind it.
 */
export function usePredictionText() {
  const t = useTranslations('DrawPrediction');
  const tGroups = useTranslations('Draws.groups');
  const format = useFormatter();
  const text = useDrawText();

  return useMemo(() => {
    const percent = (rate: number) => format.number(rate, { style: 'percent', maximumFractionDigits: 0 });
    const level = (p: GroupPrediction) => t('reliability.level', { level: p.reliability?.level ?? 'unknown' });

    return {
      group: (p: GroupPrediction) => tGroups(p.group),
      whenLabel: (p: GroupPrediction) => t('featured.window', { precise: String(p.date.precise) }),
      when: (p: GroupPrediction) =>
        t('when', {
          precise: String(p.date.precise),
          day: format.dateTime(atNoon(p.date.day), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
          week: format.dateTime(atNoon(p.date.weekStart), { day: 'numeric', month: 'long', timeZone: 'UTC' }),
        }),
      range: (p: GroupPrediction) => `${p.scores.low}–${p.scores.high}`,
      median: (p: GroupPrediction) => t('featured.median', { median: p.scores.center }),
      why: (p: GroupPrediction) => {
        const group = tGroups(p.group);
        const date = text.shortDate(p.lastDraw);
        // The predicted day always falls on the usual weekday.
        const weekday = format.dateTime(atNoon(p.date.day), { weekday: 'long', timeZone: 'UTC' });
        const sentences = [
          p.fallback
            ? t('explain.single', { group, date, days: p.gapDays })
            : t('explain.cadence', { group, date, days: p.gapDays, weekday }),
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
      level,
      reliability: (p: GroupPrediction) =>
        p.reliability
          ? t('reliability.measured', {
              group: tGroups(p.group),
              week: percent(p.reliability.weekRate),
              day: percent(p.reliability.dayRate),
              score: percent(p.reliability.scoreRate),
            })
          : t('reliability.unknown', { group: tGroups(p.group) }),
      basis: (p: GroupPrediction) =>
        t('data', {
          count: p.countInYear,
          scores: p.scores.last.length,
          type: p.category ? text.shortType(p.category.draw) : 'none',
          list: p.scores.last.map((score) => format.number(score)).join(', '),
        }),
    };
  }, [t, tGroups, format, text]);
}
