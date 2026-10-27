'use client';

import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { usePredictionText } from '@/features/draw-prediction/hooks/use-prediction-text';
import type { GroupPrediction } from '@/features/draw-prediction/lib/predict-next-draws';

const cell = 'px-5 py-4 align-top';
const head = 'px-5 py-3 font-label font-semibold uppercase tracking-wider text-slate';

/**
 * « Par type de tirage »: each active group's next expected Tirage. A table
 * from tablets up; stacked cards on phones, where four columns don't fit.
 */
export function GroupPredictions({ predictions }: { predictions: GroupPrediction[] }): ReactNode {
  const t = useTranslations('DrawPrediction.groups');
  const text = usePredictionText();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-10">
      <h2 id={titleId} className="mb-4 font-heading text-xl font-bold text-navy-deep sm:mb-5 sm:text-2xl">
        {t('title')}
      </h2>

      <div className="hidden overflow-hidden rounded-xl border border-fog-light bg-white shadow-sm sm:block">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-fog-light bg-off-white">
            <tr>
              <th scope="col" className={head}>{t('group')}</th>
              <th scope="col" className={head}>{t('window')}</th>
              <th scope="col" className={head}>{t('score')}</th>
              <th scope="col" className={head}>{t('why')}</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p) => (
              <tr key={p.group} className="border-b border-off-white last:border-b-0">
                <td className={`${cell} whitespace-nowrap font-heading font-bold text-navy-deep`}>{text.group(p)}</td>
                <td className={`${cell} text-sm font-semibold text-navy-deep`}>{text.window(p)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <span className="block font-heading font-bold text-rouge">{text.range(p)}</span>
                  <span className="text-xs text-slate">{text.median(p)}</span>
                </td>
                <td className={`${cell} text-sm text-slate`}>
                  <p>{text.why(p)}</p>
                  <p className="mt-1 text-xs">{text.basis(p)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 sm:hidden">
        {predictions.map((p) => (
          <li key={p.group} className="rounded-xl border border-fog-light bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-heading font-bold text-navy-deep">{text.group(p)}</h3>
              <p className="text-right">
                <span className="font-heading font-bold text-rouge">{text.range(p)}</span>{' '}
                <span className="text-xs text-slate">{text.median(p)}</span>
              </p>
            </div>
            <p className="mt-1 text-sm font-semibold text-navy-deep">{text.window(p)}</p>
            <p className="mt-2 text-sm text-slate">{text.why(p)}</p>
            <p className="mt-1 text-xs text-slate">{text.basis(p)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
