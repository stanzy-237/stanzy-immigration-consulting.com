'use client';

import { CalendarClock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { usePredictionText } from '@/features/draw-prediction/hooks/use-prediction-text';
import type { GroupPrediction } from '@/features/draw-prediction/lib/predict-next-draws';

/**
 * The most likely next Tirage, laid out like the latest-Tirage card: a white
 * card led by the expected CRS range in rouge with its median, then the date
 * window and the one-paragraph « why ».
 */
export function FeaturedPrediction({ prediction }: { prediction: GroupPrediction }): ReactNode {
  const t = useTranslations('DrawPrediction.featured');
  const text = usePredictionText();

  return (
    <section aria-label={t('label')}>
      <article className="rounded-3xl bg-white p-5 text-navy-deep shadow-lg sm:p-7 lg:grid lg:grid-cols-5 lg:items-center lg:gap-10 lg:p-9">
        <div className="lg:col-span-2">
          <p className="font-label font-semibold uppercase tracking-widest text-slate">{t('label')}</p>
          <h2 className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 font-label font-bold uppercase tracking-wider text-rouge">
            <Star aria-hidden={true} className="size-3 fill-rouge text-rouge" strokeWidth={0} />
            {text.group(prediction)}
          </h2>
          <div className="mt-6 flex flex-col items-center text-center lg:mt-8 lg:items-start lg:text-left">
            <p className="flex flex-col items-center lg:items-start">
              <span className="font-heading text-h1 font-bold leading-none tracking-tight text-rouge sm:text-display">
                {text.range(prediction)}
              </span>
              <span className="mt-2 text-body-sm text-slate">{t('score')}</span>
            </p>
            <p className="mt-3 rounded-full bg-blush px-3 py-1 font-heading text-caption font-bold text-rouge">
              {text.median(prediction)}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-fog-light pt-6 lg:col-span-3 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <div className="rounded-xl bg-off-white px-4 py-3">
            <p className="font-label font-semibold uppercase tracking-widest text-slate">{t('window')}</p>
            <p className="mt-1 flex items-center gap-2 font-heading text-lg font-bold text-navy-deep">
              <CalendarClock aria-hidden={true} className="size-5 shrink-0 text-rouge" />
              <span>{text.window(prediction)}</span>
            </p>
          </div>
          <p className="mt-4 text-body-sm text-slate">{text.why(prediction)}</p>
          <p className="mt-2 text-caption text-slate">{text.basis(prediction)}</p>
        </div>
      </article>
    </section>
  );
}
