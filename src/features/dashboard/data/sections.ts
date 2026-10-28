import { LayoutDashboard, Newspaper, type LucideIcon } from 'lucide-react';

/**
 * The Tableau de bord's sections, in sidebar order. A new section (Leads,
 * Clients, Contenus, …) is one more entry here plus its routes: the shell
 * reads this list and nothing else.
 */
export type DashboardSection = {
  /** Its label is `Dashboard.nav.<key>`. */
  key: 'overview' | 'blog';
  href: string;
  icon: LucideIcon;
  /** Active on its own page only, not on the sections below it. */
  exact?: boolean;
};

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  { key: 'overview', href: '/tableau-de-bord', icon: LayoutDashboard, exact: true },
  { key: 'blog', href: '/tableau-de-bord/blog', icon: Newspaper },
];

export const isSectionActive = (section: DashboardSection, pathname: string): boolean =>
  section.exact ? pathname === section.href : pathname === section.href || pathname.startsWith(`${section.href}/`);
