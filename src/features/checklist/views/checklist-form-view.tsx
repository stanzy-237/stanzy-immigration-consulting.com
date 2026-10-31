import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ChecklistFormPanel } from '@/features/checklist/components/checklist-form';
import { ChecklistHeader } from '@/features/checklist/components/checklist-header';
import { ChecklistIntro } from '@/features/checklist/components/checklist-intro';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/**
 * `/outils/checklist`, laid out like the calculators: the questions, with
 * « Votre dossier » updating beside them, then what the list gives in detail.
 */
export function ChecklistFormView(): ReactNode {
  const t = useTranslations('Checklist');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <ChecklistHeader eyebrow={t('eyebrow')} title={t('title')} accent={t('titleAccent')} lead={t('lead')} />
        <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <ChecklistFormPanel />
        </div>
        <ChecklistIntro />
      </main>
      <SiteFooter />
    </>
  );
}
