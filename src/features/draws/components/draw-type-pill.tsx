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

/**
 * `shortLabel`, when given, replaces `label` on phones (e.g. "CEC" for
 * "Catégorie de l’expérience canadienne"), so table rows stay one line.
 */
export function DrawTypePill({
  group,
  label,
  shortLabel,
  title,
}: {
  group: DrawGroup;
  label: string;
  shortLabel?: string;
  title?: string;
}): ReactNode {
  const short = shortLabel !== undefined && shortLabel !== label;
  return (
    <span
      title={title}
      className={cn('inline-block rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight sm:px-3 sm:py-1.5', GROUP_CLASSES[group])}
    >
      {short ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  );
}
