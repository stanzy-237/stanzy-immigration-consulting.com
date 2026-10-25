import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ItaCountdown } from '@/features/ita-countdown/components/ita-countdown';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { NextStepsGuide } from '@/features/shared/components/next-steps-guide';

/** The Compte à rebours ITA page: header, countdown and « À savoir » band. */
export function ItaCountdownView(): ReactNode {
  const t = useTranslations('ItaCountdown');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="mx-auto max-w-6xl px-5 pt-12 pb-8 text-center sm:px-8 lg:pt-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose bg-blush px-3 py-1 font-label uppercase tracking-widest text-rouge">
            <span aria-hidden={true} className="size-1.5 rounded-full bg-rouge" />
            {t('eyebrow')}
          </p>
          <h1 className="font-heading text-h2 font-bold leading-tight tracking-tight text-navy-deep sm:text-h1">
            {t('title')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-body text-slate">{t('lead')}</p>
        </header>
        <div className="px-5 pb-16 sm:px-8">
          <ItaCountdown />
        </div>
        <NextStepsGuide
          id="ita"
          title={t('guide.title')}
          text={t('guide.text')}
          secondary={{ href: '/outils/timeline', label: t('guide.secondary') }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
