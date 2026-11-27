import type { ReactNode } from "react";

// The blog's server read, not its components (folder rule 3).
import { toBlogLocale } from "@/features/blog/lib/blog-schema";
import { getLatestArticles } from "@/features/blog/server/blog-pages";

import { Hero } from "@/features/landing/components/hero";
import { PhoneHome } from "@/features/landing/components/phone-home";
import { SiteFooter } from "@/features/landing/components/site-footer";
import { SiteNav } from "@/features/landing/components/site-nav";
import { BlogRow } from "@/features/landing/components/blog-row";
import { ConsultationCta } from "@/features/landing/components/consultation-cta";
import { Draws } from "@/features/landing/components/draws";
import { Faq } from "@/features/landing/components/faq";
import { ServicesGrid } from "@/features/landing/components/services-grid";
import { Subscribe } from "@/features/landing/components/subscribe";
import { TikTokRow } from "@/features/landing/components/tiktok-row";
import { ToolsGrid } from "@/features/landing/components/tools-grid";
import { WhyStanzy } from "@/features/landing/components/why-stanzy";

/** The home page; the blog row shows the latest published Articles. */
export async function HomeView({ locale }: { locale: string }): Promise<ReactNode> {
  const articles = await getLatestArticles(toBlogLocale(locale));
  return (
    <>
      <SiteNav />
      <main>
        <PhoneHome />
        <div className="max-md:hidden">
          <Hero />
        </div>
        <TikTokRow />
        <ToolsGrid />
        <BlogRow articles={articles} locale={locale} />
        <Draws />
        <ConsultationCta />
        <div className="max-md:hidden">
          <ServicesGrid />
        </div>
        <WhyStanzy />
        <Subscribe />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
