'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { useLatestCrsScore } from '@/features/crs/hooks/use-latest-crs-score';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const MAX_CRS = 1200;

function parseScore(value: string): number | null {
  if (!/^\d{1,4}$/.test(value.trim())) return null;
  const score = Number(value);
  return score <= MAX_CRS ? score : null;
}

/**
 * "Votre score CRS → Comparer": the visitor's score against the latest
 * cut-off. Pre-filled from the CRS calculator's answers on this device.
 */
export function CrsCompare({ crsMin }: { crsMin: number }): ReactNode {
  const t = useTranslations('Draws.compare');
  const inputId = useId();
  const saved = useLatestCrsScore();
  const [typed, setTyped] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const value = typed ?? (saved === null ? '' : String(saved));

  const score = checked === null ? null : parseScore(checked);
  const gap = score === null ? 0 : score - crsMin;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-rouge/25 bg-rouge/10 px-5 py-4 text-sm text-white/70">
      <label htmlFor={inputId}>{t('label')}</label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          setTyped(event.target.value);
          setChecked(null);
        }}
        placeholder="—"
        inputMode="numeric"
        autoComplete="off"
        className="h-10 w-24 rounded-lg border border-white/20 bg-white/10 text-center font-heading text-base font-bold text-white outline-none placeholder:text-white/40 focus:border-rouge"
      />
      <button
        type="button"
        onClick={() => setChecked(value)}
        className="h-10 rounded-lg bg-rouge px-4 font-heading text-sm font-semibold text-white transition-colors hover:bg-crimson focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {t('button')}
      </button>
      <p role="status" className="contents">
        {checked !== null && score === null && <span className="text-xs text-rose">{t('invalid')}</span>}
        {score !== null && (
          <span
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              gap >= 0 ? 'bg-leaf-tint text-leaf' : 'bg-blush text-rouge',
            )}
          >
            {gap > 0 ? t('above', { points: gap }) : gap === 0 ? t('equal') : t('below', { points: -gap })}
          </span>
        )}
      </p>
      {score !== null && gap < 0 && (
        <Link href="/outils/crs" className="text-xs font-semibold text-white underline underline-offset-4 hover:text-rose">
          {t('improve')}
        </Link>
      )}
    </div>
  );
}
