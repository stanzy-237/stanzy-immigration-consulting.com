'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

// Presentational stub (issue #12 Implementation Decisions → Scope boundary
// with #5). The real calculator is #5's; this card renders a hard-coded
// score and funnels the visitor to the CRS tool. Matches the
// `.sn-float-card` block in the MagicPath design.
const STUB_SCORE: number = 485;

export function FloatingScoreCard(): ReactNode {
  const t = useTranslations('Home.Hero.ScoreCard');

  const handleClick = (): void => {
    track('hero.scoreCard', { score: STUB_SCORE });
  };

  return (
    <div
      className="min-w-[230px] rounded-2xl bg-white px-5 py-4 shadow-[0_8px_32px_rgba(13,31,78,0.18)]"
      style={{ animation: 'sn-float 4s ease-in-out infinite' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate">
          {t('tag')}
        </span>
        <span className="bg-blush text-rouge rounded-full px-2 py-0.5 text-[10px] font-semibold">
          {t('badge')}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-heading text-navy-deep text-3xl font-bold leading-none">
          {STUB_SCORE}
        </span>
        <span className="text-base font-medium text-slate mb-0.5">
          {t('unit')}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate">{t('sub')}</p>
      <div className="my-2.5 h-px bg-ice-blue" aria-hidden={true} />
      <div className="text-navy-deep flex items-center gap-1.5 text-sm font-medium">
        <span
          aria-hidden={true}
          className="h-2 w-2 shrink-0 rounded-full bg-green-500"
        />
        {t('status')}
      </div>
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
