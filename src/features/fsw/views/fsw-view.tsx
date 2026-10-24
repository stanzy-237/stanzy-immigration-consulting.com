import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { FswCalculator } from '@/features/fsw/components/fsw-calculator';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

/** The Calculateur 67 points page: header, calculator and "À savoir" band. */
export function FswView(): ReactNode {
  const t = useTranslations('Fsw');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="border-b border-fog bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 lg:pb-16 lg:pt-20">
            <p className="mb-5 font-label text-rouge">{t('eyebrow')}</p>
            <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
              {t('title')} <span className="text-rouge">{t('titleAccent')}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-slate">{t('lead')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-2 text-body-sm font-semibold text-rouge">
                <ShieldCheck aria-hidden={true} className="size-4" />
                {t('threshold')}
              </span>
              <span className="text-body-sm text-steel-blue">{t('notCrs')}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
          <FswCalculator />
        </div>

        <section aria-labelledby="fsw-guide-title" className="border-t border-fog bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-2 md:items-center">
            <div>
              <p className="font-label text-rouge">{t('guide.eyebrow')}</p>
              <h2 id="fsw-guide-title" className="mt-3 font-heading text-h3 font-bold text-navy-deep">
                {t('guide.title')}
              </h2>
            </div>
            <div className="space-y-4 text-body text-slate">
              <p>{t('guide.text')}</p>
              <p>
                {t('guide.funds')}{' '}
                <a
                  href={t('guide.fundsUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-rouge underline-offset-2 hover:underline"
                >
                  {t('guide.fundsLink')}
                  <ArrowUpRight aria-hidden={true} className="size-4" />
                </a>
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/outils/crs"
                  className="rounded-full bg-navy-deep px-5 py-2.5 text-body-sm font-semibold text-white transition-colors hover:bg-navy-80"
                >
                  {t('guide.crs')}
                </Link>
                <Link
                  href="/services"
                  className="rounded-full border border-fog px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
                >
                  {t('guide.consultation')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
