import { ArrowUpRight, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { FswVerdict, LanguageAssessment } from '@/features/nclc/lib/assess-language-test';
import { SCORE_ORDER, type NclcTest } from '@/features/nclc/lib/nclc-form';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';
import { cn } from '@/lib/utils';

const VERDICT_STYLES: Record<FswVerdict['status'], { box: string; Icon: typeof CircleCheck }> = {
  eligible: { box: 'border-leaf-line bg-leaf-tint text-leaf', Icon: CircleCheck },
  close: { box: 'border-honey-line bg-honey-tint text-honey', Icon: TriangleAlert },
  notEligible: { box: 'border-rose bg-blush text-rouge', Icon: CircleAlert },
};

/**
 * Travailleurs qualifiés first: whether the level meets FSW, and if not, which
 * skills to raise, with TCF preparation for a French test.
 */
function FswVerdictNote({ assessment }: { assessment: LanguageAssessment }): ReactNode {
  const t = useTranslations('Nclc.result.verdict');
  const tLanguage = useTranslations('Calculators.language');
  const format = useFormatter();
  const { status, shortSkills } = assessment.fswVerdict;
  const { box, Icon } = VERDICT_STYLES[status];
  const unit = assessment.language === 'fr' ? 'NCLC' : 'CLB';
  const skills = format.list(
    shortSkills.map((a) => tLanguage(`abilitiesByTestLanguage.${assessment.language}.${a}`)),
    { type: 'conjunction' },
  );

  return (
    <div role="note" data-status={status} className={cn('flex gap-3 rounded-xl border p-4 text-body-sm', box)}>
      <Icon aria-hidden={true} className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{t(status, { unit, skills })}</p>
        {status !== 'eligible' && assessment.language === 'fr' ? (
          <a
            href={TCF_ACADEMY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-4"
          >
            {t('prepare')}
            <ArrowUpRight aria-hidden={true} className="size-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The result: the level that counts, the Travailleurs qualifiés verdict, each
 * skill's level and one line of CRS points.
 */
export function NclcResult({ test, assessment }: { test: NclcTest; assessment: LanguageAssessment }): ReactNode {
  const t = useTranslations('Nclc.result');
  const tLanguage = useTranslations('Calculators.language');
  const unit = assessment.language === 'fr' ? 'NCLC' : 'CLB';
  const levelText = (level: number) => (level === 0 ? t('belowFour', { unit }) : t('level', { unit, level }));
  const bonus = assessment.frenchBonus;

  return (
    <section aria-label={t('title')} className="space-y-5 rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-body-sm text-slate">{t('retained')}</p>
        <p className="font-heading text-h2 font-bold leading-tight text-navy-deep">{levelText(assessment.retained)}</p>
        <p className="mt-1 text-xs text-slate">
          {t('testLine', { test: tLanguage(`tests.${test}`), language: t(`language.${assessment.language}`) })}
        </p>
      </div>

      <FswVerdictNote assessment={assessment} />

      <ul className="grid grid-cols-2 gap-2">
        {SCORE_ORDER.map((ability) => (
          <li key={ability} className="rounded-lg bg-off-white px-3 py-2.5">
            <p className="text-xs text-slate">{tLanguage(`abilitiesByTestLanguage.${assessment.language}.${ability}`)}</p>
            <p className="font-semibold text-navy-deep">{levelText(assessment.levels[ability])}</p>
          </li>
        ))}
      </ul>

      <p className="text-body-sm text-slate">
        {t('crs', { points: assessment.crsFirstLanguage })}
        {bonus ? t('frenchBonus', bonus) : null}
      </p>
    </section>
  );
}
