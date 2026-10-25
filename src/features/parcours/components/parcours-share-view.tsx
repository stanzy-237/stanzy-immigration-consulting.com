'use client';

import { XIcon } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DaysSince } from '@/features/parcours/components/days-since';
import { dateOf, daysSince } from '@/features/parcours/lib/calendar-day';
import { colorClasses } from '@/features/parcours/lib/etape-color';
import type { Etape } from '@/features/parcours/lib/etape-schema';
import { cn } from '@/lib/utils';

/**
 * The branded, screenshot-ready Parcours (« Voir la timeline »). Nothing
 * leaves the device: the User captures the screen and shares it themselves.
 * Notes stay hidden unless the User turns them on.
 */
export function ParcoursShareView({
  etapes,
  open,
  onOpenChange,
}: {
  etapes: Etape[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const t = useTranslations('Parcours');
  const format = useFormatter();
  const now = useNow();
  const notesId = useId();
  const [showNotes, setShowNotes] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setShowNotes(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 block h-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-off-white p-0 text-navy-deep ring-0 sm:max-w-none"
      >
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-ice-blue bg-white px-4 sm:px-8">
          <Image src="/logo2.png" alt="Stanzy Immigration Consulting" width={502} height={468} className="h-9 w-auto" />
          <p className="font-heading text-body-sm font-bold">{t('share.heading')}</p>
          <DialogClose
            aria-label={t('share.close')}
            className="grid size-8 place-items-center rounded-full border-2 border-fog-light bg-off-white text-slate"
          >
            <XIcon aria-hidden={true} className="size-4" />
          </DialogClose>
        </header>

        <div className="mx-auto max-w-2xl px-5 py-9 sm:px-6 sm:py-12">
          <p className="mb-2 font-label font-semibold uppercase tracking-widest text-slate">{t('share.eyebrow')}</p>
          <DialogTitle className="mb-1.5 font-heading text-3xl font-bold tracking-tight text-navy-deep sm:text-h3">
            {t('share.title')}
          </DialogTitle>
          <p className="text-body-sm text-slate">{t('count', { count: etapes.length })}</p>

          <div className="mt-5 flex items-center gap-2.5">
            <Switch id={notesId} checked={showNotes} onCheckedChange={setShowNotes} />
            <label htmlFor={notesId} className="text-body-sm text-slate">
              {t('share.showNotes')}
            </label>
            <span className="ml-auto text-caption text-steel-blue">{t('share.hint')}</span>
          </div>

          <div aria-hidden={true} className="my-7 h-px bg-fog-light" />

          <ol>
            {etapes.map((etape, index) => {
              const color = colorClasses(etape.color);
              return (
                <li key={etape.id} className="flex gap-5 pb-7">
                  <div aria-hidden={true} className="flex w-12 shrink-0 flex-col items-center">
                    <span className={cn('grid size-10 place-items-center rounded-full border-2 bg-white text-lg', color.border)}>
                      {etape.emoji}
                    </span>
                    {index < etapes.length - 1 && (
                      <span className={cn('mt-1 min-h-7 w-0.5 flex-1 bg-linear-to-b to-fog', color.line)} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <h3 className="font-heading text-lg font-bold text-navy-deep">{etape.label}</h3>
                      <time dateTime={etape.date} className="shrink-0 text-body-sm font-medium text-slate">
                        {format.dateTime(dateOf(etape.date), { day: 'numeric', month: 'short', year: 'numeric' })}
                      </time>
                    </div>
                    <DaysSince
                      days={daysSince(etape.date, now)}
                      code={etape.code}
                      borderClass={color.border}
                      className="mt-1.5 inline-flex"
                    />
                    {showNotes && etape.note && (
                      <p className="mt-2 rounded-lg border border-fog-light bg-white px-3 py-2 text-body-sm italic text-slate">
                        {etape.note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <footer className="mt-10 border-t border-fog-light pt-6 text-center">
            <p className="mb-1.5 flex items-center justify-center gap-1.5 text-caption text-slate">
              <span aria-hidden={true} className="text-rouge">
                🍁
              </span>
              {t('share.credit')}
            </p>
            <p className="text-caption font-medium text-navy-deep">stanzy-immigration-consulting.com</p>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
