import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CrsCalculator } from '@/features/crs/components/crs-calculator';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** The Calculateur CRS page: header, calculator and result card. */
export function CrsView(): ReactNode {
  const t = useTranslations('Crs');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 lg:pt-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose bg-blush px-3 py-1 font-label text-rouge">
            <span aria-hidden={true} className="size-2 rounded-full bg-rouge" />
            {t('eyebrow')}
          </p>
          <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
            {t('title')} <span className="text-rouge">— {t('titleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-body-lg text-slate">{t('lead')}</p>
        </header>
        <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <CrsCalculator />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
