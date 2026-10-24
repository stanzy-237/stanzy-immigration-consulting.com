import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  ADAPTABILITY_MAX,
  AGE_MAX,
  ARRANGED_EMPLOYMENT_POINTS,
  EDUCATION_MAX,
  FSW_MAX,
  LANGUAGE_MAX,
  WORK_MAX,
} from '@/features/fsw/data/fsw-criteria';
import type { FswAssessment } from '@/features/fsw/lib/assess-fsw';
import { cn } from '@/lib/utils';

const FACTOR_MAX = {
  language: LANGUAGE_MAX,
  education: EDUCATION_MAX,
  work: WORK_MAX,
  age: AGE_MAX,
  arrangedEmployment: ARRANGED_EMPLOYMENT_POINTS,
  adaptability: ADAPTABILITY_MAX,
} as const;

/** The sticky result card: score out of 100, verdict, what's missing, the six factors. */
export function FswResult({
  assessment,
  onReset,
}: {
  assessment: FswAssessment | null;
  onReset: () => void;
}): ReactNode {
  const t = useTranslations('Fsw.result');
  const total = assessment?.total ?? null;
  const unmet = assessment
    ? (Object.entries(assessment.requirements) as [keyof FswAssessment['requirements'], boolean][])
        .filter(([, met]) => !met)
        .map(([key]) => key)
    : [];

  return (
    <aside aria-label={t('label')}>
      <div className="overflow-hidden rounded-3xl bg-navy-deep text-white shadow-lg">
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label text-white/60">{t('label')}</p>
              <p role="status" aria-live="polite" className="mt-3 font-heading text-display font-bold leading-none tracking-tight">
                {total ?? '—'}
              </p>
              <p className="mt-1 text-body-sm text-white/60">{total === null ? t('invalid') : t('outOf')}</p>
            </div>
            {assessment ? (
              <span
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-caption font-bold',
                  assessment.eligible ? 'bg-success text-success-foreground' : 'bg-blush text-rouge',
                )}
              >
                {assessment.eligible ? t('eligible') : t('notEligible')}
              </span>
            ) : null}
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden={true}>
            <div
              className="h-full rounded-full bg-rouge transition-all duration-500"
              style={{ width: `${Math.min(100, ((total ?? 0) / FSW_MAX) * 100)}%` }}
            />
          </div>

          {assessment ? (
            <div className="mt-5 space-y-2 text-body-sm font-semibold">
              {assessment.eligible ? (
                <p className="flex items-center gap-2 text-white">
                  <Check aria-hidden={true} className="size-4 shrink-0" />
                  {t('reached')}
                </p>
              ) : null}
              {assessment.pointsShort > 0 ? (
                <p className="flex items-center gap-2 text-rose">
                  <TriangleAlert aria-hidden={true} className="size-4 shrink-0" />
                  {t('short', { points: assessment.pointsShort })}
                </p>
              ) : null}
              {unmet.map((key) => (
                <p key={key} className="flex items-start gap-2 text-rose">
                  <TriangleAlert aria-hidden={true} className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t('unmet')} {t(`requirements.${key}`)}
                  </span>
                </p>
              ))}
            </div>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-2">
            {(Object.keys(FACTOR_MAX) as (keyof typeof FACTOR_MAX)[]).map((key) => (
              <div key={key} className="rounded-xl bg-white/5 p-3">
                <dt className="font-label text-white/50">{t(`factors.${key}`)}</dt>
                <dd className="mt-1 font-heading text-h4 font-bold">
                  {assessment?.factors[key] ?? '—'}
                  <span className="ml-1 font-body text-caption font-normal text-white/50">/ {FACTOR_MAX[key]}</span>
                </dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={onReset}
            className="mt-6 flex w-full items-center justify-center gap-2 py-2 text-body-sm font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <RotateCcw aria-hidden={true} className="size-3.5" />
            {t('reset')}
          </button>
        </div>
        <p className="border-t border-white/10 bg-white/5 px-6 py-4 text-caption text-white/70">{t('disclaimer')}</p>
      </div>
    </aside>
  );
}
