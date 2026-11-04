import { ArrowRight, CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { WORKFLOWS } from '@/features/dossiers/data/workflows';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { LEVELS } from '@/features/accompagnement/lib/interest-schema';
import { Link } from '@/i18n/navigation';

const HOW = ['1', '2', '3', '4'] as const;

/**
 * Accompagnement Entrée Express (#81): what the service is, its 10 stages,
 * where each Niveau starts, and « Faire une demande » (no consultation needed
 * first) or « Réserver une consultation ».
 */
export function AccompagnementView(): ReactNode {
  const t = useTranslations('Accompagnement.page');
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <section aria-labelledby="accompagnement-title" className="px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-label text-rouge">{t('eyebrow')}</p>
            <h1 id="accompagnement-title" className="mt-3 font-heading text-h3 leading-tight font-bold text-navy-deep sm:text-h2">
              {t('title')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-body-lg text-slate">{t('lead')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/mon-espace/accompagnement"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-rouge px-7 font-heading text-body font-bold text-white hover:bg-crimson"
              >
                {t('apply')}
                <ArrowRight aria-hidden={true} className="size-4" />
              </Link>
              <Link
                href="/services/consultation"
                className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-navy-deep px-7 font-heading text-body font-bold text-navy-deep hover:bg-navy-deep hover:text-white"
              >
                <CalendarDays aria-hidden={true} className="size-4" />
                {t('consult')}
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate">{t('noConsult')}</p>
          </div>
        </section>

        <section aria-labelledby="accompagnement-levels" className="px-4 pb-16">
          <div className="mx-auto max-w-5xl">
            <h2 id="accompagnement-levels" className="mb-6 text-center font-heading text-2xl font-bold text-navy-deep">
              {t('levelsTitle')}
            </h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {LEVELS.map((level) => (
                <li key={level} className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
                  <h3 className="font-heading text-lg font-bold text-navy-deep">{t(`levels.${level}.title`)}</h3>
                  <p className="mt-2 text-sm text-slate">{t(`levels.${level}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="accompagnement-stages" className="bg-white px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 id="accompagnement-stages" className="mb-6 font-heading text-2xl font-bold text-navy-deep">
              {t('stagesTitle')}
            </h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {WORKFLOWS.ACCOMPAGNEMENT.map((stage, index) => (
                <li key={stage} className="flex items-center gap-3 rounded-xl bg-off-white px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-deep text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-navy-deep">{stages(stage)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="accompagnement-how" className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 id="accompagnement-how" className="mb-6 font-heading text-2xl font-bold text-navy-deep">
              {t('howTitle')}
            </h2>
            <ol className="grid gap-3">
              {HOW.map((step) => (
                <li key={step} className="flex gap-3 text-body text-navy-deep">
                  <span className="font-heading font-bold text-rouge">{step}.</span>
                  {t(`how.${step}`)}
                </li>
              ))}
            </ol>
            <Link
              href="/mon-espace/accompagnement"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-rouge px-7 font-heading text-body font-bold text-white hover:bg-crimson"
            >
              {t('apply')}
              <ArrowRight aria-hidden={true} className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
