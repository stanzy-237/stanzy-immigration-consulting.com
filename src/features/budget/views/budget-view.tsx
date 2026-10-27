import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { BudgetTabs } from '@/features/budget/components/budget-tabs';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/**
 * The Budget & dépenses page: the estimator, free and without an account, and
 * the Account's journal of Dépenses.
 */
export function BudgetView(): ReactNode {
  const t = useTranslations('Budget');
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
        <BudgetTabs />
      </main>
      <SiteFooter />
    </>
  );
}
