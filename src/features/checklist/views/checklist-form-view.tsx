import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ChecklistFormPanel } from '@/features/checklist/components/checklist-form';
import { ChecklistHeader } from '@/features/checklist/components/checklist-header';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** `/outils/checklist`: the questions that decide which documents to prepare. */
export function ChecklistFormView(): ReactNode {
  const t = useTranslations('Checklist');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <ChecklistHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
        <div className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
          <ChecklistFormPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
