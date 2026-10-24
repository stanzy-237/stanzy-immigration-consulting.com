import { RotateCcw, Save, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CRS_MAX } from '@/features/crs/data/crs-criteria';
import type { CrsBreakdown } from '@/features/crs/lib/compute-crs';
import { Link } from '@/i18n/navigation';

/** The sticky result card: total, its four parts, save and start over. */
export function ScoreSummary({
  breakdown,
  onSave,
  onReset,
  saving,
  saved,
  offline,
}: {
  breakdown: CrsBreakdown | null;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  saved: boolean;
  offline: boolean;
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
    <aside aria-label={t('label')} className="lg:sticky lg:top-6">
      <div className="rounded-2xl bg-navy-deep p-5 text-white shadow-xl sm:p-6">
        <p className="font-label text-xs uppercase tracking-widest text-white/60">{t('total')}</p>
        <p role="status" aria-live="polite" className="my-1 font-heading text-6xl font-bold leading-tight tracking-tight">
          {total ?? '—'}
        </p>
        <p className="text-sm text-white/60">{total === null ? t('invalid') : t('outOf')}</p>
        <div className="my-5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden={true}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-rouge to-steel-blue transition-all duration-300"
            style={{ width: `${Math.min(100, ((total ?? 0) / CRS_MAX) * 100)}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {parts.map(([key, value, max]) => (
            <div key={key} className="rounded-xl bg-white/5 p-3">
              <dt className="font-label text-xs uppercase tracking-wide text-white/50">{t(`parts.${key}`)}</dt>
              <dd className="mt-1 font-heading text-xl font-bold">
                {value ?? '—'}
                {max !== undefined ? (
                  <span className="ml-1 font-body text-xs font-normal text-white/50">{t('max', { max })}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || total === null}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-heading text-sm font-bold text-navy-deep transition-colors hover:bg-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        >
          <Save aria-hidden={true} className="size-4" />
          {t('save')}
        </button>
        {saved ? <p className="mt-2 text-center text-sm text-white/80">{t('saved')}</p> : null}
        {offline ? <p className="mt-2 text-center text-sm text-white/80">{t('saveOffline')}</p> : null}
        <button
          type="button"
          onClick={onReset}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <RotateCcw aria-hidden={true} className="size-3.5" />
          {t('reset')}
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-fog bg-ice-blue p-4 text-sm text-slate">
        <Sparkles aria-hidden={true} className="mb-2 size-4 text-rouge" />
        <p>{t('disclaimer')}</p>
        <Link href="/services" className="mt-2 inline-block font-semibold text-rouge underline-offset-2 hover:underline">
          {t('consultation')}
        </Link>
      </div>
    </aside>
  );
}
