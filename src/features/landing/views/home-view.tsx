import type { ReactNode } from 'react';

import { Hero } from '@/features/landing/components/hero';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

export function HomeView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
      </main>
      <SiteFooter />
    </>
  );
}
