import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type StatTileProps = {
  value: string;
  label: string;
  className?: string;
};

export function StatTile({ value, label, className }: StatTileProps): ReactNode {
  return (
    <div
      className={cn(
        'border-fog bg-surface flex flex-col gap-1 rounded-2xl border px-4 py-3 shadow-sm',
        className,
      )}
    >
      <span className="text-rouge font-heading text-2xl font-bold leading-none">
        {value}
      </span>
      <span className="text-navy-deep/70 text-xs leading-tight">{label}</span>
    </div>
  );
}
