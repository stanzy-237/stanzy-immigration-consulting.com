'use client';

import { ArrowRight, CalendarClock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

// The pure module only: components stay inside their own feature (folder rule 3).
import { atNoon, predictNextDraws } from '@/features/draw-prediction/lib/predict-next-draws';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';
import { Link } from '@/i18n/navigation';

/**
 * « Prochain tirage probable »: a slim line at the top of the Derniers tirages
 * body with the featured Prédiction de tirage, linking to the Prochain tirage tool.
 */
export function NextDrawPreview({ draws }: { draws: DrawSummary[] }): ReactNode {
  const t = useTranslations('Draws.nextDraw');
  const tGroups = useTranslations('Draws.groups');
  // One wording for when, shared with the Prochain tirage page.
  const tPrediction = useTranslations('DrawPrediction');
  const format = useFormatter();
  const featured = useMemo(() => predictNextDraws(draws, new Date()).featured, [draws]);
  if (!featured) return null;

  const when = tPrediction('when', {
    precise: String(featured.date.precise),
    day: format.dateTime(atNoon(featured.date.day), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    week: format.dateTime(atNoon(featured.date.weekStart), { day: 'numeric', month: 'long', timeZone: 'UTC' }),
  });

  return (
    <section aria-label={t('label')} className="mx-auto max-w-7xl px-4 pt-6 sm:px-7 sm:pt-10">
      <div className="flex flex-col gap-3 rounded-2xl border border-fog-light bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3 text-sm text-navy-deep">
          <CalendarClock aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rouge" />
          <span>
            <strong className="font-semibold">{t('lead')}</strong>{' '}
            {t('summary', { group: tGroups(featured.group), when, min: featured.scores.low, max: featured.scores.high })}
          </span>
        </p>
        <Link
          href="/outils/prochain-tirage"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-rouge hover:text-crimson"
        >
          {t('link')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </Link>
      </div>
    </section>
  );
}
