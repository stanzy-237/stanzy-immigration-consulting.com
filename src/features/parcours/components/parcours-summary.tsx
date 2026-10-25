'use client';

import { useNow, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { daysSince } from '@/features/parcours/lib/calendar-day';
import type { Etape } from '@/features/parcours/lib/etape-schema';

/** How many Étapes the User saved, and the most recent one. */
export function ParcoursSummary({ etapes }: { etapes: Etape[] }): ReactNode {
  const t = useTranslations('Parcours');
  const now = useNow();
  const recent = etapes.at(-1);

  return (
    <section aria-labelledby="parcours-summary-title" className="rounded-2xl border-2 border-fog-light bg-white p-6">
      <h2 id="parcours-summary-title" className="mb-4 font-heading text-body font-bold text-navy-deep">
        {t('summary.title')}
      </h2>
      <p className="mb-4 text-body-sm font-medium text-slate">{t('count', { count: etapes.length })}</p>
      {recent && (
        <div className="flex items-center gap-2.5 rounded-xl bg-off-white p-3">
          <span aria-hidden={true} className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-lg">
            {recent.emoji}
          </span>
          <p>
            <strong className="block text-body-sm font-semibold text-navy-deep">{recent.label}</strong>
            <span className="mt-1 block text-caption text-slate">
              {t('summary.recent', { days: daysSince(recent.date, now) })}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
