import type { ReactNode } from 'react';

import { DrawsBoard } from '@/features/draws/components/draws-board';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** The Derniers tirages page: IRCC's Express Entry rounds, latest first. */
export function DrawsView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="bg-off-white pb-16">
        <DrawsBoard />
      </main>
      <SiteFooter />
    </>
  );
}
