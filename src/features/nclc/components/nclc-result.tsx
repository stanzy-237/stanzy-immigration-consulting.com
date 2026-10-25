import { ArrowUpRight, CircleAlert, CircleCheck, CircleDashed, Lightbulb, TriangleAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PROGRAMS, type FswVerdict, type LanguageAssessment } from '@/features/nclc/lib/assess-language-test';
import { SCORE_ORDER, type NclcTest } from '@/features/nclc/lib/nclc-form';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';
import type { Ability } from '@/features/shared/lib/language-levels';
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
    <div role="note" data-status={status} className={cn('order-2 flex gap-3 rounded-xl border p-4 text-body-sm', box)}>
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
 * The result card. From `lg`: the test, the verdict, a score table, the level
 * that counts with CRS points, and the Entrée Express programs. On phones a
 * short version: the level first, the verdict, a tile per skill and one CRS
 * line. Shared blocks move with `order` rather than being drawn twice.
 */
export function NclcResult({
  test,
  scores,
  assessment,
}: {
  test: NclcTest;
  scores: Record<Ability, string>;
  assessment: LanguageAssessment;
}): ReactNode {
  const t = useTranslations('Nclc.result');
  const tLanguage = useTranslations('Calculators.language');
  const unit = assessment.language === 'fr' ? 'NCLC' : 'CLB';
  const levelText = (level: number) => (level === 0 ? t('belowFour', { unit }) : t('level', { unit, level }));

  return (
    <section aria-label={t('title')} className="flex flex-col gap-5 rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <div className="hidden items-center justify-between gap-3 lg:order-1 lg:flex">
        <h2 className="font-heading text-h4 font-bold text-navy-deep">{tLanguage(`tests.${test}`)}</h2>
        <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rouge">
          {t(`language.${assessment.language}`)}
        </span>
      </div>

      <FswVerdictNote assessment={assessment} />

      <div className="hidden overflow-hidden rounded-xl border border-fog lg:order-3 lg:block">
        <table className="w-full border-collapse text-left text-body-sm">
          <thead className="bg-off-white text-xs uppercase tracking-wide text-slate">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                {t('columns.skill')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                {t('columns.score')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                {t('columns.level', { unit })}
              </th>
            </tr>
          </thead>
          <tbody>
            {SCORE_ORDER.map((ability) => (
              <tr key={ability} className="border-t border-fog">
                <th scope="row" className="px-3 py-2.5 font-normal text-navy-deep sm:px-4">
                  {tLanguage(`abilitiesByTestLanguage.${assessment.language}.${ability}`)}
                </th>
                <td className="px-3 py-2.5 text-slate sm:px-4">{scores[ability]}</td>
                <td className="px-3 py-2.5 font-semibold text-navy-deep sm:px-4">{levelText(assessment.levels[ability])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The level that counts: first on phones, under the table from `lg`. */}
      <div className="order-1 lg:order-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-body-sm text-slate">{t('retained')}</p>
            <p className="font-heading text-h2 font-bold leading-tight text-navy-deep lg:text-h3 lg:text-rouge">
              {levelText(assessment.retained)}
            </p>
            <p className="mt-1 text-xs text-slate lg:hidden">
              {t('testLine', { test: tLanguage(`tests.${test}`), language: t(`language.${assessment.language}`) })}
            </p>
          </div>
          <div className="hidden text-right lg:block">
            <p className="text-body-sm text-slate">{t('crsLabel')}</p>
            <p className="mt-1 inline-block rounded-full bg-success/10 px-3 py-1 font-heading text-base font-bold text-success">
              {t('crsValue', { points: assessment.crsFirstLanguage })}
            </p>
          </div>
        </div>
        <p className="mt-2 hidden text-xs text-slate lg:block">{t('crsNote')}</p>
        {assessment.frenchBonus ? (
          <p className="mt-3 hidden rounded-lg bg-blush px-3 py-2 text-body-sm font-semibold text-rouge lg:block">
            {t('frenchBonus', assessment.frenchBonus)}
          </p>
        ) : null}
      </div>

      <ul aria-label={t('skillsLabel')} className="order-3 grid grid-cols-2 gap-2 lg:hidden">
        {SCORE_ORDER.map((ability) => (
          <li key={ability} className="rounded-lg bg-off-white px-3 py-2.5">
            <p className="text-xs text-slate">{tLanguage(`abilitiesByTestLanguage.${assessment.language}.${ability}`)}</p>
            <p className="font-semibold text-navy-deep">{levelText(assessment.levels[ability])}</p>
          </li>
        ))}
      </ul>

      <p className="order-4 text-body-sm text-slate lg:hidden">
        {t('crs', { points: assessment.crsFirstLanguage })}
        {assessment.frenchBonus ? t('crsBonus', assessment.frenchBonus) : null}
      </p>

      <div className="hidden lg:order-5 lg:block">
        <h3 id="nclc-programs-title" className="font-heading text-base font-bold text-navy-deep">
          {t('programsTitle')}
        </h3>
        <ul aria-labelledby="nclc-programs-title" className="mt-3 space-y-2">
          {PROGRAMS.map((program) => {
            const met = assessment.programs[program];
            return (
              <li
                key={program}
                data-met={met}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-body-sm',
                  met ? 'border-leaf-line bg-leaf-tint text-navy-deep' : 'border-fog bg-off-white text-slate',
                )}
              >
                {met ? (
                  <CircleCheck aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-leaf" />
                ) : (
                  <CircleDashed aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-slate-mute" />
                )}
                <span className="flex-1">{t(`programs.${program}`, { unit })}</span>
                <span className={cn('shrink-0 text-xs font-semibold', met ? 'text-leaf' : 'text-slate')}>
                  {met ? t('met') : t('notMet')}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** The levels worth knowing, and why the weakest skill decides. */
export function NclcLegend(): ReactNode {
  const t = useTranslations('Nclc');
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-fog bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-navy-deep">{t('legend.title')}</h2>
        <ul className="mt-3 space-y-1.5 text-body-sm text-slate">
          {(['l4', 'l5', 'l7', 'l9'] as const).map((key) => (
            <li key={key}>{t(`legend.${key}`)}</li>
          ))}
        </ul>
      </div>
      <p className="flex gap-2.5 rounded-2xl border border-honey-line bg-honey-tint p-4 text-body-sm text-honey">
        <Lightbulb aria-hidden={true} className="mt-0.5 size-4 shrink-0" />
        {t('tip')}
      </p>
    </div>
  );
}
