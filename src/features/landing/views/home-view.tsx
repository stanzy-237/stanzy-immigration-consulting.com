import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

export function HomeView(): ReactNode {
  const t = useTranslations('Home');
  return (
    <>
      <SiteNav />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-4 py-16">
        <h1 className="text-5xl font-bold text-rouge">{t('title')}</h1>
        <p className="text-2xl text-bleu">{t('tagline')}</p>
        <p className="text-lg text-bleu/70">{t('intro')}</p>
      </main>
      <SiteFooter />
    </>
  );
}
