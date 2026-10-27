'use client';

import { ExternalLink, Info, MessageCircle, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FEE_GUIDES, type GuideBlock, type GuideKey } from '@/features/budget/data/fee-guides';
import { toLocale } from '@/i18n/routing';

function Block({ block }: { block: GuideBlock }): ReactNode {
  switch (block.kind) {
    case 'text':
      return <p className="text-body-sm text-slate">{block.text}</p>;
    case 'list':
      return (
        <div>
          {block.title && <h3 className="mb-1.5 font-heading text-body-sm font-bold text-navy-deep">{block.title}</h3>}
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-slate marker:text-rouge">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case 'note':
      return (
        <p className="flex gap-2 rounded-xl border border-rose bg-blush px-3.5 py-3 text-body-sm font-medium text-navy-deep">
          <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rouge" />
          {block.text}
        </p>
      );
    case 'link':
      return (
        <a
          href={block.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-navy-deep underline underline-offset-2 hover:text-rouge"
        >
          {block.label}
          <ExternalLink aria-hidden={true} className="size-3.5" />
        </a>
      );
    case 'cta':
      return (
        <a
          href={block.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 font-heading text-body-sm font-bold text-white hover:opacity-90"
        >
          <MessageCircle aria-hidden={true} className="size-4" />
          {block.label}
        </a>
      );
  }
}

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-9/10 gap-0 overflow-y-auto p-0 sm:max-w-lg"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-fog-light bg-white px-5 py-4">
            <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{label}</DialogTitle>
            <DialogClose
              aria-label={t('closeGuide')}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-off-white text-navy-deep hover:bg-ice-blue"
            >
              <XIcon aria-hidden={true} className="size-4" />
            </DialogClose>
          </div>
          <div className="flex flex-col gap-4 px-5 py-5">
            {content.image && (
              // eslint-disable-next-line @next/next/no-img-element -- consultant-provided image, any host
              <img src={content.image.src} alt={content.image.alt} className="w-full rounded-xl object-cover" />
            )}
            {content.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
