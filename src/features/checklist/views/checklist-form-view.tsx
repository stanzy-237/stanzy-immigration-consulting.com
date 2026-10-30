import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ChecklistFormPanel } from '@/features/checklist/components/checklist-form';
import { ChecklistHeader } from '@/features/checklist/components/checklist-header';
import { ChecklistIntro } from '@/features/checklist/components/checklist-intro';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** `/outils/checklist`: what the list gives, then the questions that decide which documents to prepare. */
export function ChecklistFormView(): ReactNode {
  const t = useTranslations('Checklist');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <ChecklistHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
        <div className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
          <ChecklistIntro />
          <ChecklistFormPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
