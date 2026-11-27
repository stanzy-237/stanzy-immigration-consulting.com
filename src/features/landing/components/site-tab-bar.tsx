'use client';

import { BookOpenText, Gauge, House, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const TABS: { key: 'home' | 'tools' | 'services' | 'blog' | 'account'; href: string; icon: LucideIcon }[] = [
  { key: 'home', href: '/', icon: House },
  { key: 'tools', href: '/outils', icon: Gauge },
  { key: 'services', href: '/services', icon: ShoppingBag },
  { key: 'blog', href: '/blog', icon: BookOpenText },
  { key: 'account', href: '/compte', icon: UserRound },
];

/**
 * Task screens (`PWA · Navigation mobile · Règles`, 3): booking, paying, a
 * private offer, a Réunion, signing in. They keep the site's header and no
 * tab bar; everything else on a phone gets the bar.
 */
const TASK_PREFIXES = ['/services/consultation/reserver', '/services/offre', '/reunion', '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe', '/verification'];

/** Pages with their own action bar at the bottom (« Réserver » on the Consultation page): that bar instead. */
const OWN_BAR = new Set(['/services/consultation']);

export function isTaskPath(pathname: string): boolean {
  if (OWN_BAR.has(pathname)) return true;
  return TASK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * The visitor's tab bar on a phone (`PWA · Visiteur`): Accueil, Outils,
 * Services, Blog, Compte, in place of the ≡ menu. Hidden from `md` up.
 */
export function SiteTabBar(): ReactNode {
  const t = useTranslations('Home.Tabs');
  const pathname = usePathname() ?? '/';
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav
      aria-label={t('label')}
      data-site-tabs=""
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-fog-light bg-white px-1 pt-2.5 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => {
        const on = active(tab.href);
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
