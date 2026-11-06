import type { ReactNode } from 'react';

/**
 * The maple leaf the Accompagnement page's story ends on, in the current
 * colour. Decorative: hidden from assistive technology.
 */
export function MapleLeaf({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 64 64" aria-hidden={true} className={className} fill="currentColor">
      <path d="M32 2l5.2 10.4 6.3-3.2-2.3 13.1 8.6-9.1 1.9 5.8 9.3-1.8-3.2 9.8 4.2 2.1-13.5 11 1.9 5.3-13.4-2.2.6 14.8h-4.8l.6-14.8-13.4 2.2 1.9-5.3-13.5-11 4.2-2.1-3.2-9.8 9.3 1.8 1.9-5.8 8.6 9.1-2.3-13.1 6.3 3.2z" />
    </svg>
  );
}
