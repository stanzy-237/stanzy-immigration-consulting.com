import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The red maple leaf of the ITA countdown (decorative). */
export function MapleLeaf({ className }: { className?: string }): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 80 80" className={cn('fill-rouge', className)}>
      <path d="M40 2l4.2 12 9.4-4.2-2.8 10 9.2 3-8.2 4.6 2.4 9L44 32.6 40 48l-3.8-15.4-9.8 3.8 2.4-9-8.2-4.6 9.2-3-2.8-10 9.4 4.2z" />
    </svg>
  );
}
