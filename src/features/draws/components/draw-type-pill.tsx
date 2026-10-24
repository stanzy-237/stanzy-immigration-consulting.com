import type { ReactNode } from 'react';

import type { DrawGroup } from '@/features/draws/lib/normalize-ircc-rounds';
import { cn } from '@/lib/utils';

/** Pill colours per Type de tirage, from the MagicPath design. */
const GROUP_CLASSES: Record<DrawGroup, string> = {
  PNP: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CEC: 'border-green-300 bg-green-50 text-green-700',
  FRENCH: 'border-rose bg-blush text-rouge',
  CATEGORY: 'border-amber-300 bg-amber-100 text-amber-700',
  GENERAL: 'border-fog bg-ice-blue text-navy-deep',
};

export function DrawTypePill({ group, label, title }: { group: DrawGroup; label: string; title?: string }): ReactNode {
  return (
    <span
      title={title}
      className={cn('inline-block rounded-full border px-3 py-1.5 font-label font-semibold leading-tight', GROUP_CLASSES[group])}
    >
      {label}
    </span>
  );
}
