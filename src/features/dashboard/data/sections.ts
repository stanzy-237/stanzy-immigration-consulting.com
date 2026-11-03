import { FileSignature, FileStack, FolderKanban, LayoutDashboard, Newspaper, ReceiptText, Users, type LucideIcon } from 'lucide-react';

/**
 * The Tableau de bord's sections, in sidebar order. A new section (Leads,
 * Clients, Contenus, …) is one more entry here plus its routes: the shell
 * reads this list and nothing else.
 */
export type DashboardSection = {
  /** Its label is `Dashboard.nav.<key>`. */
  key: 'overview' | 'dossiers' | 'comptes' | 'factures' | 'outils-pdf' | 'signatures' | 'blog';
  /** Its address on the dashboard's subdomain. */
  href: string;
  /** The first route segment below the dashboard it owns; null for the Aperçu. */
  segment: string | null;
  icon: LucideIcon;
  /** The sidebar group it sits in; its label is `Dashboard.nav.groups.<group>`. */
  group: DashboardGroup;
};

/** The sidebar's groups, in order. */
export const DASHBOARD_GROUPS = ['general', 'clients', 'billing', 'tools', 'content'] as const;
export type DashboardGroup = (typeof DASHBOARD_GROUPS)[number];

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  { key: 'overview', href: '/', segment: null, icon: LayoutDashboard, group: 'general' },
  { key: 'dossiers', href: '/dossiers', segment: 'dossiers', icon: FolderKanban, group: 'clients' },
  { key: 'comptes', href: '/comptes', segment: 'comptes', icon: Users, group: 'clients' },
  { key: 'signatures', href: '/signatures', segment: 'signatures', icon: FileSignature, group: 'clients' },
  { key: 'factures', href: '/factures', segment: 'factures', icon: ReceiptText, group: 'billing' },
  { key: 'outils-pdf', href: '/outils-pdf', segment: 'outils-pdf', icon: FileStack, group: 'tools' },
  { key: 'blog', href: '/blog', segment: 'blog', icon: Newspaper, group: 'content' },
];

/** `segments` are the route segments below the dashboard's layout (`['blog', 'post_7']`). */
export const isSectionActive = (section: DashboardSection, segments: string[]): boolean =>
  (segments[0] ?? null) === section.segment;
