import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** « 90 jours depuis ITA », edged in the Étape's colour. */
export function DaysSince({
  days,
  code,
  borderClass,
  className,
}: {
  days: number;
  code: string;
  borderClass: string;
  className?: string;
}): ReactNode {
  const t = useTranslations('Parcours');
  return (
    <span
      className={cn(
        'flex flex-wrap items-baseline gap-1.5 rounded-lg border-l-4 bg-off-white px-2.5 py-2',
        borderClass,
        className,
      )}
    >
      <span className="font-heading text-body-sm font-bold tracking-tight text-navy-deep">{days}</span>
      <span className="font-label uppercase tracking-wider text-slate">{t('daysSince', { days })}</span>
      <span className="rounded-sm bg-blush px-1.5 py-1 font-label font-bold uppercase tracking-wide text-rouge">
        {code}
      </span>
    </span>
  );
}
