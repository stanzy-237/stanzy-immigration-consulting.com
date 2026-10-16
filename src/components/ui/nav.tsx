import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Top navigation primitive. Maps to the "Navigation" section of the Stanzy
 * Design System: white background, fog border-bottom, shadow-sm, active link
 * uses canada-red (Rouge). Server-component by default — pass `activeHref`
 * from the server so no client state is needed.
 */
export function Nav({
  brand,
  children,
  actions,
  className,
  ...props
}: ComponentPropsWithoutRef<'nav'> & {
  brand?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <nav
      className={cn(
        'bg-surface border-fog sticky top-0 z-20 w-full border-b shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4">
        {brand ? (
          <div className="font-heading text-navy-deep text-xl font-bold">
            {brand}
          </div>
        ) : null}
        <ul className="flex items-center gap-6">{children}</ul>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </nav>
  );
}

export interface NavItemProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'children'> {
  active?: boolean;
  children: ReactNode;
}

/**
 * A single nav link. Active = Rouge text with Rouge underline, per design md.
 * Uses the locale-aware next-intl `Link` under the hood.
 */
export function NavItem({
  active = false,
  className,
  children,
  ...props
}: NavItemProps) {
  return (
    <li>
      <Link
        {...props}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'font-body text-ink hover:text-rouge inline-block py-1 text-sm font-medium transition-colors',
          active && 'text-rouge border-rouge border-b-2',
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}
