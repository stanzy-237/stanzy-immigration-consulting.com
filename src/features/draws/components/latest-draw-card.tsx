'use client';

import { ExternalLink, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CrsCompare } from '@/features/draws/components/crs-compare';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/**
 * The hero's latest Tirage, laid out like the home page's: a light card led
 * by the minimum CRS score (and its change since the last round of the same
 * type), then the facts that matter: category, invitations, date and the
 * tie-breaking rule. The score comparison stays on the navy hero beneath.
 */
export function LatestDrawCard({ draw }: { draw: DrawSummary }): ReactNode {
  const t = useTranslations('Draws.latest');
  const tFacts = useTranslations('Draws.latest.facts');
  const tGroups = useTranslations('Draws.groups');
  const format = useFormatter();
  const text = useDrawText();
  const change = draw.crsChange;

  return (
    <section aria-label={t('label')}>
      <article className="rounded-3xl bg-white p-5 text-navy-deep shadow-lg sm:p-7 lg:grid lg:grid-cols-5 lg:items-center lg:gap-10 lg:p-9">
        <div className="lg:col-span-2">
          <p className="font-label font-semibold uppercase tracking-widest text-slate">{t('label')}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 font-label font-bold uppercase tracking-wider text-rouge">
              <Star aria-hidden={true} className="size-3 fill-rouge text-rouge" strokeWidth={0} />
              {t('round', { round: draw.round })}
            </h2>
            {draw.irccUrl && (
              <a
                href={draw.irccUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-fog-light bg-off-white px-3 py-1 text-xs font-medium text-slate transition-colors hover:border-fog hover:text-navy-deep"
              >
                <ExternalLink aria-hidden={true} className="size-3.5" />
                {t('irccLink')}
              </a>
            )}
          </div>
          <div className="mt-6 flex flex-col items-center text-center lg:mt-8 lg:items-start lg:text-left">
            <p className="flex flex-col items-center lg:items-start">
              <span className="font-heading text-display font-bold leading-none tracking-tight text-rouge lg:text-8xl">
                {draw.crsMin}
              </span>
              <span className="mt-2 text-body-sm text-slate">{t('scoreLabel')}</span>
            </p>
            <p className="mt-3 flex items-center gap-2 text-caption text-slate">
              {change !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 font-heading font-bold ${
                    change > 0 ? 'bg-blush text-rouge' : change < 0 ? 'bg-leaf-tint text-leaf' : 'bg-off-white text-slate'
                  }`}
                >
                  {change > 0 ? `+${change}` : String(change)}
                </span>
              )}
              <span>{change === null ? t('changeNone') : t('changeSub', { group: tGroups(draw.group) })}</span>
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-2.5 border-t border-fog-light pt-6 sm:grid-cols-2 lg:col-span-3 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          {(
            [
              ['category', text.type(draw)],
              ['invitations', format.number(draw.invitations)],
              ['date', text.date(draw)],
              ['tieBreak', text.tieBreak(draw) ?? tFacts('none')],
            ] as const
          ).map(([fact, value]) => (
            <div key={fact} className="rounded-xl bg-off-white px-4 py-3">
              <dt className="font-label font-semibold uppercase tracking-widest text-slate">{tFacts(fact)}</dt>
              <dd className="mt-1 font-heading text-body font-bold text-navy-deep">{value}</dd>
            </div>
          ))}
        </dl>
      </article>
      <CrsCompare crsMin={draw.crsMin} />
    </section>
  );
}
