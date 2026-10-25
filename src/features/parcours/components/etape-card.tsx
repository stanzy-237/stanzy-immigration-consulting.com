'use client';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DaysSince } from '@/features/parcours/components/days-since';
import { dateOf, daysSince } from '@/features/parcours/lib/calendar-day';
import { colorClasses } from '@/features/parcours/lib/etape-color';
import type { Etape } from '@/features/parcours/lib/etape-schema';
import { cn } from '@/lib/utils';

/** One Étape in the feed; clicking it opens it for editing. */
export function EtapeCard({ etape, onEdit }: { etape: Etape; onEdit: () => void }): ReactNode {
  const t = useTranslations('Parcours');
  const format = useFormatter();
  const now = useNow();
  const color = colorClasses(etape.color);

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t('edit', { label: etape.label })}
      className="flex w-full items-start gap-3.5 rounded-2xl border-2 border-fog-light bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-fog hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge"
    >
      <span aria-hidden={true} className={cn('grid size-12 shrink-0 place-items-center rounded-xl text-2xl', color.tint)}>
        {etape.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('inline-flex rounded-sm px-2 py-1 font-label font-bold uppercase tracking-wider', color.tint, color.text)}>
          {etape.code}
        </span>
        <strong className="mt-2 block font-heading text-body font-bold tracking-tight text-navy-deep">
          {etape.label}
        </strong>
        <span className="mt-1 block text-caption text-slate">
          {format.dateTime(dateOf(etape.date), { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <DaysSince
          days={daysSince(etape.date, now)}
          code={etape.code}
          borderClass={color.border}
          className="mt-2"
        />
        {etape.note && <span className="mt-1 block truncate text-caption text-steel-blue">{etape.note}</span>}
      </span>
    </button>
  );
}
