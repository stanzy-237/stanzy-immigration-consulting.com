import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LastDrawCard } from '@/features/landing/components/last-draw-card';
import {
  CnpIllustration,
  CrsIllustration,
  ItaIllustration,
  NclcIllustration,
  PdfIllustration,
  SixtySevenIllustration,
} from '@/features/landing/components/tool-illustrations';
import { Link } from '@/i18n/navigation';

export const PHONE_TOOLS = [
  { key: 'crs', href: '/outils/crs', Illustration: CrsIllustration },
  { key: 'points', href: '/outils/67-points', Illustration: SixtySevenIllustration },
  { key: 'nclc', href: '/outils/nclc-clb', Illustration: NclcIllustration },
  { key: 'cnp', href: '/outils/cnp', Illustration: CnpIllustration },
  { key: 'ita', href: '/outils/compte-a-rebours-ita', Illustration: ItaIllustration },
  { key: 'pdf', href: '/outils/pdf', Illustration: PdfIllustration },
] as const;

/**
 * `/outils` on a phone (`PWA · Visiteur · 2 Outils`): the title, a 2 × 3
 * grid of illustrated tools, the last Tirage. The desktop mosaic is hidden.
 */
export function PhoneTools(): ReactNode {
  const t = useTranslations('Home.Phone');
  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-8 md:hidden">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">{t('toolsTitle')}</h1>
        <p className="text-body-sm text-slate">{t('toolsLead')}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {PHONE_TOOLS.map(({ key, href, Illustration }) => (
          <li key={key}>
            <Link href={href} className="flex h-full flex-col gap-2 rounded-2xl border border-fog-light bg-white p-3.5">
              <Illustration className="size-14" />
              <span className="text-body font-bold text-ink">{t(`tools.${key}.name`)}</span>
              <span className="text-caption text-slate">{t(`tools.${key}.lead`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <LastDrawCard />
    </div>
  );
}
