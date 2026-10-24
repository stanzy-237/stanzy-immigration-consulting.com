'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useLatestCrsScore } from '@/features/crs/hooks/use-latest-crs-score';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

// Shows the visitor's own latest CRS score once they have used the
// calculator (#5). Before that it keeps the stub score until the live draw
// data (#7) replaces it. Matches the `.sn-float-card` block in the MagicPath
// design.
const STUB_SCORE: number = 485;

export function FloatingScoreCard(): ReactNode {
  const t = useTranslations('Home.Hero.ScoreCard');
  const latest = useLatestCrsScore();
  const score = latest ?? STUB_SCORE;

  const handleClick = (): void => {
    track('hero.scoreCard', { score });
  };

  return (
    <div
      className="min-w-56 rounded-2xl bg-white px-5 py-4 shadow-xl"
      style={{ animation: 'sn-float 4s ease-in-out infinite' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate">
          {latest === null ? t('tag') : t('yourTag')}
        </span>
        <span className="bg-blush text-rouge rounded-full px-2 py-0.5 text-xs font-semibold">
          {t('badge')}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-heading text-navy-deep text-3xl font-bold leading-none">
          {score}
        </span>
        <span className="text-base font-medium text-slate mb-0.5">
          {t('unit')}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate">{latest === null ? t('sub') : t('yourSub')}</p>
      <div className="my-2.5 h-px bg-ice-blue" aria-hidden={true} />
      {latest === null ? (
        <div className="text-navy-deep flex items-center gap-1.5 text-sm font-medium">
          <span
            aria-hidden={true}
            className="h-2 w-2 shrink-0 rounded-full bg-green-500"
          />
          {t('status')}
        </div>
      ) : null}
      <Link
        href="/outils/crs"
        onClick={handleClick}
        className="bg-navy-deep hover:bg-navy-80 mt-2.5 block w-full rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors"
      >
        {t('cta')}
      </Link>

      <style jsx>{`
        @keyframes sn-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
