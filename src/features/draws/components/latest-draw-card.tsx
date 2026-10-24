'use client';

import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CrsCompare } from '@/features/draws/components/crs-compare';
import { DrawTypePill } from '@/features/draws/components/draw-type-pill';
import { useDrawText } from '@/features/draws/hooks/use-draw-text';
import type { DrawSummary } from '@/features/draws/server/draws-router';
import { cn } from '@/lib/utils';

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="mb-2 font-label font-semibold uppercase tracking-widest text-white/50">{label}</p>
      <p className={cn('font-heading text-3xl font-bold sm:text-4xl', accent ? 'text-rouge' : 'text-white')}>{value}</p>
      <p className="mt-1 text-xs text-white/50">{sub}</p>
    </div>
  );
}

/** The hero's latest-Tirage card: number, type, three stats and the score comparison. */
export function LatestDrawCard({ draw }: { draw: DrawSummary }): ReactNode {
  const t = useTranslations('Draws.latest');
  const tGroups = useTranslations('Draws.groups');
  const format = useFormatter();
  const text = useDrawText();
  const change = draw.crsChange;

  return (
    <section
      aria-label={t('label')}
      className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="mb-2 font-label font-semibold uppercase tracking-widest text-white/50">{t('label')}</p>
          <h2 className="mb-3 font-heading text-5xl font-bold tracking-tight text-white sm:text-6xl">
            <span className="text-white/30">#</span>
            {draw.round}
          </h2>
          <DrawTypePill group={draw.group} label={text.type(draw)} title={draw.typeLabel} />
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="text-sm text-white/70">{text.date(draw)}</p>
          {draw.irccUrl && (
            <a
              href={draw.irccUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
            >
              <ExternalLink aria-hidden={true} className="size-3.5" />
              {t('irccLink')}
            </a>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t('invitations')} value={format.number(draw.invitations)} sub={t('invitationsSub')} />
        <Stat label={t('crsMin')} value={String(draw.crsMin)} sub={t('crsMinSub')} accent />
        <Stat
          label={t('change')}
          value={change === null ? '—' : change > 0 ? `+${change}` : String(change)}
          sub={change === null ? t('changeNone') : t('changeSub', { group: tGroups(draw.group) })}
        />
      </div>
      <CrsCompare crsMin={draw.crsMin} />
    </section>
  );
}
