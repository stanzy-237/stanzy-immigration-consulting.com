'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';

/** The phone's bottom sheet around the Étape form. */
export function EtapeSheet({
  open,
  onOpenChange,
  editing,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('Parcours');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-9/10 gap-0 overflow-y-auto rounded-t-3xl px-4.5 pt-3 pb-7 shadow-lg lg:hidden"
      >
        <div aria-hidden={true} className="mx-auto mb-4.5 h-1 w-10 rounded-full bg-fog-light" />
        <div className="mb-4.5 flex items-center justify-between gap-3">
          <SheetTitle className="font-heading text-xl font-bold text-navy-deep">
            {editing ? t('form.editTitle') : t('form.addTitle')}
          </SheetTitle>
          <SheetClose
            aria-label={t('form.closeSheet')}
            className="grid size-10 place-items-center rounded-full bg-off-white text-navy-deep"
          >
            <XIcon aria-hidden={true} className="size-5" />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
