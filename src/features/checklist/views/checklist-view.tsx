import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ChecklistBoard } from '@/features/checklist/components/checklist-board';
import { ChecklistHeader } from '@/features/checklist/components/checklist-header';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { NextStepsGuide } from '@/features/shared/components/next-steps-guide';

/**
 * `/outils/checklist/liste`: each person's documents, with the progress
 * beside them, then the « À savoir » band like the other tools.
 */
export function ChecklistView(): ReactNode {
  const t = useTranslations('Checklist');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <ChecklistHeader eyebrow={t('eyebrow')} title={t('listTitle')} accent={t('listAccent')} lead={t('listLead')} />
        <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <ChecklistBoard />
        </div>
        <NextStepsGuide
          id="checklist"
          title={t('guide.title')}
          text={t('guide.text')}
          secondary={{ href: '/outils/compte-a-rebours-ita', label: t('guide.secondary') }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
