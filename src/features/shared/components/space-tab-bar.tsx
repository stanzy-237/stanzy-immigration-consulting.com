'use client';

import { CalendarDays, FileText, House, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const TABS: { key: 'home' | 'consultations' | 'documents' | 'profile'; href: string; icon: LucideIcon; match: (path: string) => boolean }[] = [
  { key: 'home', href: '/mon-espace', icon: House, match: (p) => p === '/mon-espace' || p.startsWith('/mon-espace/dossiers') },
  { key: 'consultations', href: '/mon-espace/consultations', icon: CalendarDays, match: (p) => p.startsWith('/mon-espace/consultations') },
  { key: 'documents', href: '/mon-espace/services', icon: FileText, match: (p) => p.startsWith('/mon-espace/services') },
  { key: 'profile', href: '/compte', icon: UserRound, match: (p) => p.startsWith('/compte') },
];

/**
 * Mon espace on a phone (`Mon espace v2 · Mobile`): the tab bar at the
 * bottom (Accueil, Consultations, Documents, Profil). Hidden from `sm` up,
 * where the site nav does the job. Pages using it leave room at the bottom.
 */
export function SpaceTabBar(): ReactNode {
  const t = useTranslations('Shared.spaceTabs');
  const path = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-fog-light bg-white px-3 pt-2.5 sm:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => {
        const active = tab.match(path);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex w-21 flex-col items-center gap-1 text-label font-semibold', active ? 'font-bold text-rouge' : 'text-slate')}
          >
            <tab.icon aria-hidden={true} className="size-5.5" strokeWidth={active ? 2.4 : 2} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Room under the content for the tab bar, on phones. */
export const TAB_BAR_ROOM = 'max-sm:pb-28';
