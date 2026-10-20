import type { LucideIcon } from 'lucide-react';
import { FileCheck, GraduationCap, ScrollText, Users } from 'lucide-react';

export type ServiceTag = {
  labelKey: string;
  variant?: 'default' | 'regional';
};

export type Service = {
  slug: string;
  icon: LucideIcon;
  nameKey: string;
  descKey: string;
  href: string;
  external?: boolean;
  externalLabelKey?: string;
  tags: ReadonlyArray<ServiceTag>;
};

// Four services from the MagicPath "Nos Services" 2x2 grid.
export const SERVICES: ReadonlyArray<Service> = [
  {
    slug: 'accompagnement',
    icon: Users,
    nameKey: 'accompagnementName',
    descKey: 'accompagnementDesc',
    href: '/services/accompagnement',
    tags: [
      { labelKey: 'tagFollowUp' },
      { labelKey: 'tagProfileToRp' },
      { labelKey: 'tagDuration' },
    ],
  },
  {
    slug: 'verification',
    icon: FileCheck,
    nameKey: 'verificationName',
    descKey: 'verificationDesc',
    href: '/services/verification',
    tags: [
      { labelKey: 'tagIrccReview' },
      { labelKey: 'tagZeroError' },
      { labelKey: 'tagSubmit' },
    ],
  },
  {
    slug: 'tcf',
    icon: GraduationCap,
    nameKey: 'tcfName',
    descKey: 'tcfDesc',
    href: 'https://tcf-express-academy.com',
    external: true,
    externalLabelKey: 'tcfExternal',
    tags: [
      { labelKey: 'tagTcf' },
      { labelKey: 'tagOnline' },
      { labelKey: 'tagTcfDomain' },
    ],
  },
  {
    slug: 'ede',
    icon: ScrollText,
    nameKey: 'edeName',
    descKey: 'edeDesc',
    href: '/services/ede',
    tags: [
      { labelKey: 'tagWes' },
      { labelKey: 'tagIquas' },
      { labelKey: 'tagCameroonOnly', variant: 'regional' },
    ],
  },
] as const;
