import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { ParcoursJournal, ParcoursJournalSkeleton } from '@/features/parcours/components/parcours-journal';

/** The Parcours page: the signed-in User's dated Étapes. */
export function ParcoursView(): ReactNode {
  return (
    <>
      <SiteNav />
      <QueryBoundary fallback={<ParcoursJournalSkeleton />}>
        <ParcoursJournal />
      </QueryBoundary>
      <SiteFooter />
    </>
  );
}
