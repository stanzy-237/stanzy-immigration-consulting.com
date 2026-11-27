'use client';

import { BookOpenText, CalendarDays, FileText, Gauge, House, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type Tab = { key: string; href: string; icon: LucideIcon; match?: (path: string) => boolean };

/** Signed out (`PWA · Visiteur`). */
const VISITOR_TABS: Tab[] = [
  { key: 'home', href: '/', icon: House },
  { key: 'tools', href: '/outils', icon: Gauge },
  { key: 'services', href: '/services', icon: ShoppingBag },
  { key: 'blog', href: '/blog', icon: BookOpenText },
  { key: 'account', href: '/compte', icon: UserRound },
];

/** A signed-in Client (`PWA · Navigation mobile · Règles`, Client connecté). */
const CLIENT_TABS: Tab[] = [
  {
    key: 'mySpace',
    href: '/mon-espace',
    icon: House,
    match: (p) => p === '/mon-espace' || ['/mon-espace/dossiers', '/mon-espace/notifications', '/mon-espace/accompagnement'].some((x) => p.startsWith(x)),
  },
  { key: 'consultations', href: '/mon-espace/consultations', icon: CalendarDays },
  { key: 'documents', href: '/mon-espace/services', icon: FileText },
  { key: 'tools', href: '/outils', icon: Gauge },
  { key: 'profile', href: '/compte', icon: UserRound },
];

/**
 * Task screens (`PWA · Navigation mobile · Règles`, 3): booking, paying, a
 * private offer, a Réunion, signing in. They keep the site's header and no
 * tab bar; everything else on a phone gets the bar.
 */
const TASK_PREFIXES = ['/services/consultation/reserver', '/services/offre', '/reunion', '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe', '/verification'];

/** Pages with their own action bar at the bottom (« Réserver » on the Consultation page): that bar instead. */
const OWN_BAR = new Set(['/services/consultation']);
/** Client pages with their own bar or a full-screen task: a Consultation (« Et maintenant ? »), a Réunion, signing. */
const OWN_BAR_PATTERNS = [/^\/mon-espace\/consultations\/[^/]+$/, /^\/mon-espace\/reunions\//, /^\/mon-espace\/dossiers\/[^/]+\/signer\//];

/** A Client page with its own « ‹ » and bottom bar: neither the site header nor the tab bar. */
export function isOwnBarPath(pathname: string): boolean {
  return OWN_BAR_PATTERNS.some((re) => re.test(pathname));
}

export function isTaskPath(pathname: string): boolean {
  if (OWN_BAR.has(pathname) || isOwnBarPath(pathname)) return true;
  return TASK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * The site's tab bar on a phone, in place of the ≡ menu: the visitor's
 * (Accueil, Outils, Services, Blog, Compte) or the signed-in Client's (Mon
 * espace, Consultations, Documents, Outils, Profil). Hidden from `md` up.
 */
export function SiteTabBar({ audience = 'visitor' }: { audience?: 'visitor' | 'client' }): ReactNode {
  const t = useTranslations('Home.Tabs');
  const pathname = usePathname() ?? '/';
  const tabs = audience === 'client' ? CLIENT_TABS : VISITOR_TABS;
  const under = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const active = (tab: Tab) => (tab.match ? tab.match(pathname) : under(tab.href));
  return (
    <nav
      aria-label={t('label')}
      data-site-tabs=""
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-fog-light bg-white px-1 pt-2.5 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((tab) => {
        const on = active(tab);
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
