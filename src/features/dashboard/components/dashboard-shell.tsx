'use client';

import { ExternalLink, Menu, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { DASHBOARD_SECTIONS, isSectionActive } from '@/features/dashboard/data/sections';

function SectionLinks({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const t = useTranslations('Dashboard.nav');
  // Below the dashboard's layout, whatever the address (admin.<site>/blog).
  const segments = useSelectedLayoutSegments();

  return (
    <nav aria-label={t('label')}>
      <ul className="flex flex-col gap-1">
        {DASHBOARD_SECTIONS.map((section) => {
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
    </nav>
  );
}

/**
 * The Tableau de bord's frame around every dashboard page: the sections in a
 * sidebar from tablets up, behind a menu button in a drawer on phones, and a
 * header greeting the consultant with a way back to the public site, which
 * is on the main domain (`siteUrl`).
 */
export function DashboardShell({
  name,
  siteUrl,
  children,
}: {
  name: string;
  siteUrl: string;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-off-white md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-fog-light bg-white px-4 py-6 md:block">
        <p className="mb-8 flex items-center gap-2.5 px-2">
          <Image src="/logo2.png" alt="" width={502} height={468} className="h-9 w-auto" />
          <span className="font-heading text-sm font-bold text-navy-deep">{t('title')}</span>
        </p>
        <SectionLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-fog-light bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('nav.openMenu')}
              className="grid size-10 place-items-center rounded-xl text-navy-deep hover:bg-ice-blue md:hidden"
            >
              <Menu aria-hidden={true} className="size-5" />
            </button>
            <p className="font-heading text-base font-bold text-navy-deep">{t('greeting', { name })}</p>
          </div>
          <a
            href={siteUrl}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-fog-light px-3.5 py-1.5 text-sm font-semibold text-navy-deep hover:border-navy-deep"
          >
            {t('viewSite')}
            <ExternalLink aria-hidden={true} className="size-3.5" />
          </a>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen} showSwipeHandle>
        <DrawerContent className="rounded-t-3xl pt-2 md:hidden">
          <div className="flex items-center justify-between px-5 pt-2 pb-4">
            <DrawerTitle className="font-heading text-lg font-bold text-navy-deep">{t('nav.menuTitle')}</DrawerTitle>
            <DrawerClose
              aria-label={t('nav.close')}
              className="grid size-9 place-items-center rounded-full bg-off-white text-navy-deep hover:bg-ice-blue"
            >
              <XIcon aria-hidden={true} className="size-4" />
            </DrawerClose>
          </div>
          <div className="px-4 pb-8">
            <SectionLinks onNavigate={() => setMenuOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
