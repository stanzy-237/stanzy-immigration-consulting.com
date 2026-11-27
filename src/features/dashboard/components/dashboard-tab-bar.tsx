'use client';

import { CalendarDays, Ellipsis, FolderClosed, LayoutGrid, Video, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The four sections a tab reaches straight away; everything else is under « Plus ». */
export const TAB_SEGMENTS = [null, 'consultations', 'reunions', 'dossiers'] as const;

const TABS: { key: 'overview' | 'consultations' | 'reunions' | 'dossiers' | 'more'; href: string; segment: string | null; icon: LucideIcon }[] = [
  { key: 'overview', href: '/', segment: null, icon: LayoutGrid },
  { key: 'consultations', href: '/consultations', segment: 'consultations', icon: CalendarDays },
  { key: 'reunions', href: '/reunions', segment: 'reunions', icon: Video },
  { key: 'dossiers', href: '/dossiers', segment: 'dossiers', icon: FolderClosed },
  { key: 'more', href: '/plus', segment: 'plus', icon: Ellipsis },
];

/**
 * The Tableau de bord on a phone (`Tableau de bord · Mobile v2`, PWA rules):
 * a tab bar at the bottom in place of the sidebar. A section without its own
 * tab lights « Plus ». Hidden from `md` up, where the sidebar is.
 */
export function DashboardTabBar(): ReactNode {
  const t = useTranslations('Dashboard.tabs');
  const segments = useSelectedLayoutSegments();
  const current = segments[0] ?? null;
  // A task screen (a Consultation, a Réunion's room) or one with its own action bar (Codes promo,
  // « + Nouveau code ») has its bar at the bottom instead (PWA rules).
  if (((current === 'consultations' || current === 'reunions') && segments.length > 1) || current === 'codes-promo') return null;
  const active = (TAB_SEGMENTS as readonly (string | null)[]).includes(current) ? current : 'plus';
  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-fog-light bg-white px-1 pt-2.5 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => {
        const on = tab.segment === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn('flex min-w-0 flex-1 flex-col items-center gap-1 text-label whitespace-nowrap', on ? 'font-bold text-rouge' : 'font-semibold text-slate')}
          >
            <tab.icon aria-hidden={true} className="size-5.5" strokeWidth={on ? 2.4 : 2} />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
