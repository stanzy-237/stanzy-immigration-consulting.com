import type { ReactNode } from 'react';

import { Hero } from '@/features/landing/components/hero';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { BlogRow } from '@/features/landing/components/blog-row';
import { ConsultationCta } from '@/features/landing/components/consultation-cta';
import { Draws } from '@/features/landing/components/draws';
import { Faq } from '@/features/landing/components/faq';
import { ServicesGrid } from '@/features/landing/components/services-grid';
import { Subscribe } from '@/features/landing/components/subscribe';
import { TikTokRow } from '@/features/landing/components/tiktok-row';
import { ToolsGrid } from '@/features/landing/components/tools-grid';
import { WhyStanzy } from '@/features/landing/components/why-stanzy';

export function HomeView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <TikTokRow />
        <ToolsGrid />
        <Draws />
        <ConsultationCta />
        <ServicesGrid />
        <WhyStanzy />
        <BlogRow />
        <Subscribe />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
