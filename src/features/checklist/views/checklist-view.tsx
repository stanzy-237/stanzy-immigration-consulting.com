import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ChecklistBoard, ChecklistDisclaimer } from '@/features/checklist/components/checklist-board';
import { ChecklistHeader } from '@/features/checklist/components/checklist-header';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** `/outils/checklist/liste`: the documents to prepare, mandatory first, each with its guide. */
export function ChecklistView(): ReactNode {
  const t = useTranslations('Checklist');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <ChecklistHeader eyebrow={t('eyebrow')} title={t('listTitle')} lead={t('listLead')} />
        <div className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
          <ChecklistBoard />
          <ChecklistDisclaimer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
