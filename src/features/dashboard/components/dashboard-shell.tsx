'use client';

import { ExternalLink, XIcon } from 'lucide-react';
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
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { DASHBOARD_GROUPS, DASHBOARD_SECTIONS, isSectionActive } from '@/features/dashboard/data/sections';
import { NotificationBell } from '@/features/shared/components/notification-bell';

/**
 * The Tableau de bord's frame around every dashboard page: from tablets up,
 * the shadcn Sidebar, its sections grouped, folding down to its icons (the
 * button, ⌘/Ctrl + B, or the rail; remembered in a cookie); on phones, the
 * bottom drawer. A header with the greeting and the bell; the way back to
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
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-fog-light bg-white/95 px-4 backdrop-blur sm:px-7">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger aria-label={t('nav.toggle')} className="size-10 text-navy-deep" />
              <p className="truncate font-heading text-base font-bold text-navy-deep">{t('greeting', { name })}</p>
            </div>
            <NotificationBell audience="consultant" />
          </header>
          {/* SidebarInset is the page's <main>. */}
          <div className="flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

/**
 * The sections: on phones the bottom drawer (swipe it down, or the menu
 * button), from tablets up the sidebar. The header's menu button opens the
 * one or folds the other.
 */
function ShellNavigation({ siteUrl }: { siteUrl: string }): ReactNode {
  const t = useTranslations('Dashboard');
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Drawer open={openMobile} onOpenChange={setOpenMobile} showSwipeHandle>
        <DrawerContent className="rounded-t-3xl pt-2">
          <div className="flex items-center justify-between px-5 pt-2 pb-4">
            <DrawerTitle className="font-heading text-lg font-bold text-navy-deep">{t('title')}</DrawerTitle>
            <DrawerClose
              aria-label={t('nav.close')}
              className="grid size-9 place-items-center rounded-full bg-off-white text-navy-deep hover:bg-ice-blue"
            >
              <XIcon aria-hidden={true} className="size-4" />
            </DrawerClose>
          </div>
          <div className="grid gap-4 px-4 pb-8">
            <DrawerSections onNavigate={() => setOpenMobile(false)} />
            <a
              href={siteUrl}
              className="flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-navy-deep hover:bg-ice-blue"
            >
              <ExternalLink aria-hidden={true} className="size-4.5 shrink-0" />
              {t('viewSite')}
            </a>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

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

/** The phone drawer's sections, under their group labels; choosing one closes it. */
function DrawerSections({ onNavigate }: { onNavigate: () => void }): ReactNode {
  const t = useTranslations('Dashboard.nav');
  const segments = useSelectedLayoutSegments();
  return (
    <nav aria-label={t('label')} className="grid gap-4">
      {DASHBOARD_GROUPS.map((group) => {
        const sections = DASHBOARD_SECTIONS.filter((section) => section.group === group);
        if (sections.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-3.5 pb-1 text-xs font-semibold tracking-wider text-slate uppercase">
              {t(`groups.${group}`)}
            </p>
            <ul className="flex flex-col gap-1">
              {sections.map((section) => {
                const active = isSectionActive(section, segments);
                const Icon = section.icon;
                return (
                  <li key={section.key}>
                    <Link
                      href={section.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                        active ? 'bg-navy-deep text-white' : 'text-navy-deep hover:bg-ice-blue'
                      }`}
                    >
                      <Icon aria-hidden={true} className="size-4.5 shrink-0" />
                      {t(section.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** The logo, and the title while the sidebar is open. */
function Brand(): ReactNode {
  const t = useTranslations('Dashboard');
  const folded = useSidebar().state === 'collapsed';
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1 py-1.5">
      <Image src="/logo2.png" alt="" width={502} height={468} className="size-8 shrink-0 object-contain" />
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
