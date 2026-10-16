import type { ReactNode } from 'react';

import { Hero } from '@/features/landing/components/hero';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { TikTokRow } from '@/features/landing/components/tiktok-row';

export function HomeView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <TikTokRow />
      </main>
      <SiteFooter />
    </>
  );
}
