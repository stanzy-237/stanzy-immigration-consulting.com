import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * AppShell — the common page frame: Nav slot, main content, Footer slot.
 * Keeps every page downstream (landing, tools, blog, admin) from
 * re-stitching the chrome. Pure composition, no state. Maps to the "Layout"
 * section of the Stanzy Design System.
 */
export function AppShell({
  nav,
  footer,
  children,
  className,
}: {
  nav?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-screen flex-col', className)}>
      {nav}
      <main className="flex-1">{children}</main>
      {footer}
    </div>
  );
}
