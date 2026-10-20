import type { ReactNode } from 'react';

import { Hero } from '@/features/landing/components/hero';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { BlogRow } from '@/features/landing/components/blog-row';
import { TikTokRow } from '@/features/landing/components/tiktok-row';
import { ToolsGrid } from '@/features/landing/components/tools-grid';

export function HomeView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <TikTokRow />
        <ToolsGrid />
        <BlogRow />
      </main>
      <SiteFooter />
    </>
  );
}
