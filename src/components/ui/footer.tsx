import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Site footer primitive. Navy ground, white text, slot-based so pages
 * compose their own column groups. Maps to the generic footer treatment in
 * the Stanzy Design System.
 */
export function Footer({
  children,
  bottom,
  className,
  ...props
}: ComponentPropsWithoutRef<'footer'> & { bottom?: ReactNode }) {
  return (
    <footer
      className={cn(
        'bg-navy-deep text-white mt-24 w-full py-16',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-4">
          {children}
        </div>
        {bottom ? (
          <div className="border-navy-80 text-steel-blue border-t pt-6 text-sm">
            {bottom}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
