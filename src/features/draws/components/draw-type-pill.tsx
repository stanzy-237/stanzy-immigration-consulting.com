import type { ReactNode } from 'react';

import type { DrawGroup } from '@/features/draws/lib/draw-type';
import { cn } from '@/lib/utils';

/** Pill colours per Type de tirage, from the MagicPath design. */
const GROUP_CLASSES: Record<DrawGroup, string> = {
  PNP: 'border-iris-line bg-iris-tint text-iris',
  CEC: 'border-leaf-line bg-leaf-tint text-leaf',
  FRENCH: 'border-rose bg-blush text-rouge',
  CATEGORY: 'border-honey-line bg-honey-tint text-honey',
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
