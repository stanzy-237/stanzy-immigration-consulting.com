'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardTabBar } from '@/features/dashboard/components/dashboard-tab-bar';
import { DASHBOARD_GROUPS, DASHBOARD_SECTIONS, isSectionActive } from '@/features/dashboard/data/sections';
import { NotificationBell } from '@/features/shared/components/notification-bell';
import { ReportProblemButton } from '@/features/shared/components/report-problem';

/**
 * The Tableau de bord's frame around every dashboard page: from tablets up,
 * the shadcn Sidebar, its sections grouped, folding down to its icons (the
 * button, ⌘/Ctrl + B, or the rail; remembered in a cookie); on phones, a tab
 * bar and « Plus » (PWA rules). A header with the greeting and the bell; the way back to
 * the public site, on the main domain (`siteUrl`), at the bottom.
 */
export function DashboardShell({
  name,
  siteUrl,
  defaultOpen = true,
  children,
}: {
  name: string;
  siteUrl: string;
  /** Folded or not, as the consultant left it (the `sidebar_state` cookie). */
  defaultOpen?: boolean;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('Dashboard');

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <ShellNavigation siteUrl={siteUrl} />

        <SidebarInset className="min-w-0 bg-off-white">
          {/* Phones have no header: each screen has its own title, and the tab bar does the navigating. */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-fog-light bg-white/95 px-4 backdrop-blur max-md:hidden sm:px-7">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger aria-label={t('nav.toggle')} className="size-10 text-navy-deep" />
              <p className="truncate font-heading text-base font-bold text-navy-deep">{t('greeting', { name })}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ReportProblemButton />
              <NotificationBell audience="consultant" />
            </div>
          </header>
          {/* SidebarInset is the page's <main>. */}
          <div className="min-w-0 flex-1 px-4 py-6 max-md:pt-safe max-md:pb-32 sm:px-7 sm:py-8">{children}</div>
          <DashboardTabBar />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

/**
 * The sections, in the sidebar from tablets up (phones have the tab bar). The
 * header's menu button folds it.
 */
function ShellNavigation({ siteUrl }: { siteUrl: string }): ReactNode {
  const t = useTranslations('Dashboard');
  const { isMobile } = useSidebar();

  // Phones: the tab bar at the bottom (DashboardTabBar) and « Plus » replace the sidebar.
  if (isMobile) return null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Brand />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SectionGroups />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t('viewSite')} render={<a href={siteUrl} />}>
              <ExternalLink aria-hidden={true} />
              <span>{t('viewSite')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** The logo, and the title while the sidebar is open. */
function Brand(): ReactNode {
  const t = useTranslations('Dashboard');
  const folded = useSidebar().state === 'collapsed';
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1 py-1.5">
      {/* A white disc: the logo's navy and red disappear on the navy sidebar. */}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm">
        <Image src="/logo2.png" alt="" width={502} height={468} className="size-full object-contain" />
      </span>
      {folded ? (
        <span className="sr-only">{t('title')}</span>
      ) : (
        <span className="truncate font-heading text-sm font-bold text-sidebar-foreground">{t('title')}</span>
      )}
    </Link>
  );
}

/** The sections under their group labels; the current one is marked. On a phone, choosing one closes the sheet. */
function SectionGroups(): ReactNode {
  const t = useTranslations('Dashboard.nav');
  // Below the dashboard's layout, whatever the address (admin.<site>/blog).
  const segments = useSelectedLayoutSegments();

  return (
    <nav aria-label={t('label')}>
      {DASHBOARD_GROUPS.map((group) => {
        const sections = DASHBOARD_SECTIONS.filter((section) => section.group === group);
        if (sections.length === 0) return null;
        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{t(`groups.${group}`)}</SidebarGroupLabel>
            <SidebarMenu>
              {sections.map((section) => {
                const active = isSectionActive(section, segments);
                const Icon = section.icon;
                return (
                  <SidebarMenuItem key={section.key}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={t(section.key)}
                      render={<Link href={section.href} aria-current={active ? 'page' : undefined} />}
                    >
                      <Icon aria-hidden={true} />
                      <span>{t(section.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        );
      })}
    </nav>
  );
}
