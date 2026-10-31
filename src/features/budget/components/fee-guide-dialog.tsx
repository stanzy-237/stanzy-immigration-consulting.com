'use client';

import { Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { FEE_GUIDES, type GuideKey } from '@/features/budget/data/fee-guides';
import { GuideBlocks, GuideDialog } from '@/features/shared/components/guide-blocks';
import { toLocale } from '@/i18n/routing';

/** « En savoir plus » on an estimator line: a dialog with that cost's guide. */
export function FeeGuideButton({ guide, label }: { guide: GuideKey; label: string }): ReactNode {
  const t = useTranslations('Budget.estimator');
  const content = FEE_GUIDES[toLocale(useLocale())][guide];
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('learnMoreAbout', { line: label })}
        className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-rouge underline-offset-2 hover:underline"
      >
        <Info aria-hidden={true} className="size-3.5" />
        {t('learnMore')}
      </button>
      <GuideDialog open={open} onOpenChange={setOpen} title={label} closeLabel={t('closeGuide')}>
        {content.image && (
          // eslint-disable-next-line @next/next/no-img-element -- consultant-provided image, any host
          <img src={content.image.src} alt={content.image.alt} className="w-full rounded-xl object-cover" />
        )}
        <GuideBlocks blocks={content.blocks} />
      </GuideDialog>
    </>
  );
}
