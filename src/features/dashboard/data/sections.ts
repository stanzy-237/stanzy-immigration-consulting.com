import { FolderKanban, LayoutDashboard, Newspaper, type LucideIcon } from 'lucide-react';

/**
 * The Tableau de bord's sections, in sidebar order. A new section (Leads,
 * Clients, Contenus, …) is one more entry here plus its routes: the shell
 * reads this list and nothing else.
 */
export type DashboardSection = {
  /** Its label is `Dashboard.nav.<key>`. */
  key: 'overview' | 'dossiers' | 'blog';
  /** Its address on the dashboard's subdomain. */
  href: string;
  /** The first route segment below the dashboard it owns; null for the Aperçu. */
  segment: string | null;
  icon: LucideIcon;
};

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  { key: 'overview', href: '/', segment: null, icon: LayoutDashboard },
  { key: 'dossiers', href: '/dossiers', segment: 'dossiers', icon: FolderKanban },
  { key: 'blog', href: '/blog', segment: 'blog', icon: Newspaper },
];

/** `segments` are the route segments below the dashboard's layout (`['blog', 'post_7']`). */
export const isSectionActive = (section: DashboardSection, segments: string[]): boolean =>
  (segments[0] ?? null) === section.segment;
