import { RotateCcw, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CRS_MAX } from '@/features/crs/data/crs-criteria';
import type { CrsBreakdown } from '@/features/crs/lib/compute-crs';

/** The sticky result card: total, its four parts, save and start over. */
export function ScoreSummary({
  breakdown,
  onSave,
  onReset,
  saving,
}: {
  breakdown: CrsBreakdown | null;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}): ReactNode {
  const t = useTranslations('Crs.summary');
  const total = breakdown?.total ?? null;
  const parts = [
    ['core', breakdown?.core.total, breakdown?.maxima.core],
    ['spouse', breakdown?.spouse.total, breakdown?.maxima.spouse],
    ['transferability', breakdown?.transferability.total, breakdown?.maxima.transferability],
    ['additional', breakdown?.additional.total, breakdown?.maxima.additional],
  ] as const;

  return (
    <aside aria-label={t('label')}>
      <div className="rounded-2xl bg-navy-deep p-5 text-white shadow-lg sm:p-6">
        <p className="font-label text-white/60">{t('total')}</p>
        <p role="status" aria-live="polite" className="my-1 font-heading text-display font-bold leading-none tracking-tight">
          {total ?? '—'}
        </p>
        <p className="text-body-sm text-white/60">{total === null ? t('invalid') : t('outOf')}</p>
        <div className="my-5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden={true}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-rouge to-steel-blue transition-all duration-300"
            style={{ width: `${Math.min(100, ((total ?? 0) / CRS_MAX) * 100)}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {parts.map(([key, value, max]) => (
            <div key={key} className="rounded-xl bg-white/5 p-3">
              <dt className="font-label text-white/50">{t(`parts.${key}`)}</dt>
              <dd className="mt-1 font-heading text-h4 font-bold">
                {value ?? '—'}
                {max !== undefined ? (
                  <span className="ml-1 font-body text-caption font-normal text-white/50">{t('max', { max })}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || total === null}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-heading text-body-sm font-bold text-navy-deep transition-colors hover:bg-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        >
          <Save aria-hidden={true} className="size-4" />
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-body-sm font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <RotateCcw aria-hidden={true} className="size-3.5" />
          {t('reset')}
        </button>
      </div>
    </aside>
  );
}
