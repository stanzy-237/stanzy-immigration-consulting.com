'use client';

import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

/** « Faire une demande » on the Accompagnement page, counted with where on the page it was clicked. */
export function ApplyLink({
  from,
  className,
  children,
}: {
  from: 'hero' | 'how' | 'cta';
  className: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Link href="/mon-espace/accompagnement" onClick={() => track('accompagnement.apply', { from })} className={className}>
      {children}
    </Link>
  );
}
