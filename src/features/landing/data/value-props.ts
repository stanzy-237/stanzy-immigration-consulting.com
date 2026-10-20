import type { LucideIcon } from 'lucide-react';
import { Compass, Sparkles, Wrench } from 'lucide-react';

export type ValueProp = {
  slug: string;
  icon: LucideIcon;
  nameKey: string;
  descKey: string;
  featured?: boolean;
  // Optional proof pill shown on the featured card.
  proofKey?: string;
};

// Three "Pourquoi Stanzy" value props. The first is the featured navy card
// with a "80% de réussite" proof pill.
export const VALUE_PROPS: ReadonlyArray<ValueProp> = [
  {
    slug: 'experts',
    icon: Sparkles,
    nameKey: 'expertsName',
    descKey: 'expertsDesc',
    featured: true,
    proofKey: 'expertsProof',
  },
  {
    slug: 'single-contact',
    icon: Compass,
    nameKey: 'contactName',
    descKey: 'contactDesc',
  },
  {
    slug: 'free-tools',
    icon: Wrench,
    nameKey: 'toolsName',
    descKey: 'toolsDesc',
  },
] as const;
