import type { ReactNode } from "react";

import { ConsultationCta } from "@/features/landing/components/consultation-cta";
import { SiteFooter } from "@/features/landing/components/site-footer";
import { SiteNav } from "@/features/landing/components/site-nav";
import { ToolsGrid } from "@/features/landing/components/tools-grid";

/** `/outils`: every tool on one page, the home page's mosaic as its heading. */
export function ToolsView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main>
        <ToolsGrid headingLevel="h1" />
        <ConsultationCta />
      </main>
      <SiteFooter />
    </>
  );
}
