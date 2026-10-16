import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ShieldCheck,
  FileSearch,
  FileCheck,
  GanttChartSquare,
  Hourglass,
  Leaf,
  ListChecks,
  Users,
  Video,
} from 'lucide-react';

export type NavMenuEntry = {
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
  href: string;
  maple?: boolean;
  separator?: boolean;
};

export const TOOL_ENTRIES: ReadonlyArray<NavMenuEntry> = [
  {
    icon: GanttChartSquare,
    labelKey: 'timelineName',
    descKey: 'timelineDesc',
    href: '/outils/timeline',
  },
  {
    icon: ShieldCheck,
    labelKey: 'cloudsName',
    descKey: 'cloudsDesc',
    href: '/outils/coffre-fort',
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
    icon: FileSearch,
    labelKey: 'cnpName',
    descKey: 'cnpDesc',
    href: '/outils/cnp',
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
