import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { ParcoursJournal } from '@/features/parcours/components/parcours-journal';

/** The Parcours page: the signed-in User's dated Étapes. */
export function ParcoursView(): ReactNode {
  return (
    <>
      <SiteNav />
      <ParcoursJournal />
      <SiteFooter />
    </>
  );
}
