import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardList,
  Clock,
  Cloud,
  Languages,
  Search,
  Timer,
  TrendingUp,
} from 'lucide-react';

export type ToolVariant = 'default' | 'featured' | 'wide';

export type Tool = {
  slug: string;
  icon: LucideIcon;
  nameKey: string;
  descKey: string;
  href: string;
  variant: ToolVariant;
  badgeKeys: ReadonlyArray<string>;
  // Freeness/badge pill shown in the top-left of non-featured cards.
  freeKey: string;
};

// Seven cards in the mosaic order from the MagicPath design
// ("Stanzy Immigration — Navigation", revision 460790112943476736):
// row 1: [featured] [·] [·]   row 2: [wide] [·]   row 3: [wide] [·]
export const TOOLS: ReadonlyArray<Tool> = [
  {
    slug: 'timeline',
    icon: Clock,
    nameKey: 'timelineName',
    descKey: 'timelineDesc',
    href: '/outils/timeline',
    variant: 'featured',
    badgeKeys: ['badgeExpressEntry', 'badgeRpCanada'],
    freeKey: 'free',
  },
  {
    slug: 'nclc',
    icon: Languages,
    nameKey: 'nclcName',
    descKey: 'nclcDesc',
    href: '/outils/nclc-clb',
    variant: 'default',
    badgeKeys: ['badgeNclcClb', 'badgeLanguageTests'],
    freeKey: 'free',
  },
  {
    slug: 'ita',
    icon: Timer,
    nameKey: 'itaName',
    descKey: 'itaDesc',
    href: '/outils/compte-a-rebours-ita',
    variant: 'default',
    badgeKeys: ['badge60Days', 'badgeIta'],
    freeKey: 'free',
  },
  {
    slug: 'fsw',
    icon: ClipboardList,
    nameKey: 'fswName',
    descKey: 'fswDesc',
    href: '/outils/67-points',
    variant: 'wide',
    badgeKeys: ['badgeFswp', 'badgeEligibility', 'badgeInstantScore'],
    freeKey: 'free',
  },
  {
    slug: 'crs',
    icon: BarChart3,
    nameKey: 'crsName',
    descKey: 'crsDesc',
    href: '/outils/crs',
    variant: 'default',
    badgeKeys: ['badgeCrs', 'badgeDraw'],
    freeKey: 'free',
  },
  {
    slug: 'draw',
    icon: TrendingUp,
    nameKey: 'drawName',
    descKey: 'drawDesc',
    href: '/outils/dernier-tirage',
    variant: 'wide',
    badgeKeys: ['badgeIrccLive', 'badgeCompare', 'badgeMapleExpressEntry'],
    freeKey: 'freeLive',
  },
  {
    slug: 'cnp',
    icon: Search,
    nameKey: 'cnpName',
    descKey: 'cnpDesc',
    href: '/outils/cnp',
    variant: 'default',
    badgeKeys: ['badgeCnp2021', 'badgeTeer'],
    freeKey: 'free',
  },
] as const;

/**
 * Tools that have a page but no card on the home grid. The Coffre-fort's
 * card made way for the NCLC / CLB calculator; its placeholder page stays.
 */
export const UNLISTED_TOOLS: ReadonlyArray<Tool> = [
  {
    slug: 'clouds',
    icon: Cloud,
    nameKey: 'cloudsName',
    descKey: 'cloudsDesc',
    href: '/outils/coffre-fort',
    variant: 'default',
    badgeKeys: ['badgeCrsProfile', 'badgeAnalysis'],
    freeKey: 'free',
  },
];
