import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LastDrawCard } from '@/features/landing/components/last-draw-card';
import {
  BudgetIllustration,
  ChecklistIllustration,
  CrsIllustration,
  DrawIllustration,
  ItaIllustration,
  NclcIllustration,
  PdfIllustration,
  PredictionIllustration,
  SixtySevenIllustration,
  TimelineIllustration,
} from '@/features/landing/components/tool-illustrations';
import { TOOLS } from '@/features/landing/data/tools';
import { Link } from '@/i18n/navigation';

/** Each tool's drawing; the phone order puts the most used first. */
const ILLUSTRATIONS: Record<string, (props: { className?: string }) => ReactNode> = {
  crs: CrsIllustration,
  fsw: SixtySevenIllustration,
  nclc: NclcIllustration,
  ita: ItaIllustration,
  timeline: TimelineIllustration,
  draw: DrawIllustration,
  prediction: PredictionIllustration,
  budget: BudgetIllustration,
  checklist: ChecklistIllustration,
  pdf: PdfIllustration,
};
const ORDER = Object.keys(ILLUSTRATIONS);

/** Every tool a visitor can use today (listed, not « Bientôt »), as on the desktop grid. */
const PHONE_TOOLS = TOOLS.filter((tool) => tool.listed !== false && !tool.comingSoon).sort(
  (a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99),
);

/**
 * `/outils` on a phone (`PWA · Visiteur · 2 Outils`): the title, a grid of
 * every tool, illustrated, the last Tirage. The desktop mosaic is hidden.
 */
export function PhoneTools(): ReactNode {
  const t = useTranslations('Home.Phone');
  const tGrid = useTranslations('Home.ToolsGrid');
  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-8 md:hidden">
      <div className="flex flex-col gap-1">
        <p role="heading" aria-level={1} className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">{t('toolsTitle')}</p>
        <p className="text-body-sm text-slate">{t('toolsLead')}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {PHONE_TOOLS.map((tool) => {
          const Illustration = ILLUSTRATIONS[tool.slug];
          return (
            <li key={tool.slug}>
              <Link href={tool.href} className="flex h-full flex-col gap-2 rounded-2xl border border-fog-light bg-white p-3.5">
                {Illustration ? (
                  <Illustration className="size-14" />
                ) : (
                  <span className="grid size-14 place-items-center rounded-full bg-ice-blue text-navy-deep">
                    <tool.icon aria-hidden={true} className="size-6" />
                  </span>
                )}
                <span className="text-body font-bold text-ink">{t.has(`tools.${tool.slug}.name`) ? t(`tools.${tool.slug}.name`) : tGrid(tool.nameKey)}</span>
                <span className="text-caption text-slate">{t.has(`tools.${tool.slug}.lead`) ? t(`tools.${tool.slug}.lead`) : tGrid(tool.descKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <LastDrawCard />
    </div>
  );
}
