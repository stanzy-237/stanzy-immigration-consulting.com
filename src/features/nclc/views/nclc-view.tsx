import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { NclcCalculator } from '@/features/nclc/components/nclc-calculator';
import { NextStepsGuide } from '@/features/shared/components/next-steps-guide';

/** The Calculateur NCLC / CLB page: header, calculator and « À savoir » band. */
export function NclcView(): ReactNode {
  const t = useTranslations('Nclc');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="border-b border-fog bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 lg:pb-16 lg:pt-20">
            <p className="mb-5 inline-flex items-center gap-2 font-label text-rouge">
              <Languages aria-hidden={true} className="size-4" />
              {t('eyebrow')}
            </p>
            <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
              {t('title')} <span className="text-rouge">{t('titleAccent')}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-slate">{t('lead')}</p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
          <NclcCalculator />
        </div>

        <NextStepsGuide
          id="nclc"
          title={t('guide.title')}
          text={t('guide.text')}
          secondary={{ href: '/outils/crs', label: t('guide.secondary') }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
