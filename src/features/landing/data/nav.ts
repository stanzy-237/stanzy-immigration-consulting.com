import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  Calculator,
  ClipboardCheck,
  ShieldCheck,
  FileSearch,
  FileCheck,
  GanttChartSquare,
  Hourglass,
  Languages,
  Leaf,
  ListChecks,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

export type NavMenuEntry = {
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
  href: string;
  maple?: boolean;
  separator?: boolean;
  // The page is a placeholder: the entry is tagged « Bientôt ». Keep these last.
  comingSoon?: true;
};

export const TOOL_ENTRIES: ReadonlyArray<NavMenuEntry> = [
  {
    icon: GanttChartSquare,
    labelKey: 'timelineName',
    descKey: 'timelineDesc',
    href: '/outils/timeline',
  },
  {
    icon: Hourglass,
    labelKey: 'itaName',
    descKey: 'itaDesc',
    href: '/outils/compte-a-rebours-ita',
  },
  {
    icon: ListChecks,
    labelKey: 'fswName',
    descKey: 'fswDesc',
    href: '/outils/67-points',
  },
  {
    icon: Languages,
    labelKey: 'nclcName',
    descKey: 'nclcDesc',
    href: '/outils/nclc-clb',
  },
  {
    icon: Calculator,
    labelKey: 'crsName',
    descKey: 'crsDesc',
    href: '/outils/crs',
  },
  {
    icon: Leaf,
    labelKey: 'drawName',
    descKey: 'drawDesc',
    href: '/outils/dernier-tirage',
    maple: true,
  },
  {
    icon: CalendarClock,
    labelKey: 'predictionName',
    descKey: 'predictionDesc',
    href: '/outils/prochain-tirage',
  },
  {
    icon: Wallet,
    labelKey: 'budgetName',
    descKey: 'budgetDesc',
    href: '/outils/budget',
  },
  {
    icon: ClipboardCheck,
    labelKey: 'checklistName',
    descKey: 'checklistDesc',
    href: '/outils/checklist',
  },
  // Not built yet: last, tagged « Bientôt ».
  {
    icon: FileSearch,
    labelKey: 'cnpName',
    descKey: 'cnpDesc',
    href: '/outils/cnp',
    comingSoon: true,
  },
  {
    icon: ShieldCheck,
    labelKey: 'cloudsName',
    descKey: 'cloudsDesc',
    href: '/outils/coffre-fort',
    comingSoon: true,
  },
] as const;

export const SERVICE_ENTRIES: ReadonlyArray<NavMenuEntry> = [
  {
    icon: Video,
    labelKey: 'consultationName',
    descKey: 'consultationDesc',
    href: '/services/consultation',
  },
  {
    icon: Users,
    labelKey: 'accompagnementName',
    descKey: 'accompagnementDesc',
    href: '/services/accompagnement',
  },
  {
    icon: FileCheck,
    labelKey: 'verificationName',
    descKey: 'verificationDesc',
    href: '/services/verification',
  },
] as const;
