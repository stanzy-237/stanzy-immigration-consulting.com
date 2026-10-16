'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

// Presentational stub (issue #12 Implementation Decisions → Scope boundary
// with #5). The real calculator is #5's; this card renders a hard-coded
// score and funnels the visitor to the CRS tool.
const STUB_SCORE: number = 478;

export function FloatingScoreCard(): ReactNode {
  const t = useTranslations('Home.Hero.ScoreCard');

  const handleClick = (): void => {
    track('hero.scoreCard', { score: STUB_SCORE });
  };

  return (
    <div className="border-fog bg-surface relative flex w-72 flex-col gap-4 rounded-2xl border p-5 shadow-xl">
      <span className="bg-rouge/10 text-rouge inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <Sparkles aria-hidden={true} className="h-3.5 w-3.5" />
        {t('chip')}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-navy-deep/60 text-xs font-semibold uppercase tracking-wider">
          {t('eyebrow')}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-navy-deep font-heading text-4xl font-bold leading-none">
            {STUB_SCORE}
          </span>
          <span className="text-navy-deep/60 text-xs">{t('unit')}</span>
        </div>
        <div className="bg-fog/60 relative mt-1 h-1.5 w-full overflow-hidden rounded-full">
          <span
            aria-hidden={true}
            className="bg-rouge absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(100, (STUB_SCORE / 1200) * 100)}%` }}
          />
        </div>
      </div>
      <Link
        href="/outils/crs"
        onClick={handleClick}
        className="text-rouge inline-flex items-center gap-1 text-sm font-semibold hover:text-rouge/80"
      >
        {t('cta')}
        <ArrowRight aria-hidden={true} className="h-4 w-4" />
      </Link>
    </div>
  );
}
