import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type StatTileProps = {
  value: string;
  label: string;
  highlight?: boolean;
  className?: string;
};

// Renders a bare "big number + small label" stat as the MagicPath hero
// shows them (`.sn-stat` + `.sn-stat-num`), no card chrome. Padding and the
// hair-line dividers between tiles live on the parent row in Hero.
export function StatTile({
  value,
  label,
  highlight,
  className,
}: StatTileProps): ReactNode {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        className={cn(
          'font-heading text-4xl font-bold leading-none tracking-tight',
          highlight ? 'text-rouge' : 'text-navy-deep',
        )}
      >
        {value}
      </span>
      <span className="text-sm font-normal leading-tight text-slate">
        {label}
      </span>
    </div>
  );
}
