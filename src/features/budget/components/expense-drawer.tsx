'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

/** The phone's drawer around the Dépense form; swipe it down to close. */
export function ExpenseDrawer({
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
  const t = useTranslations('Budget.form');
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="rounded-t-3xl pt-2 shadow-lg lg:hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4.5 pt-3 pb-4">
          <DrawerTitle className="font-heading text-xl font-bold text-navy-deep">
            {editing ? t('editTitle') : t('addTitle')}
          </DrawerTitle>
          <DrawerClose
            aria-label={t('closeDrawer')}
            className="grid size-10 place-items-center rounded-full bg-off-white text-navy-deep"
          >
            <XIcon aria-hidden={true} className="size-5" />
          </DrawerClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4.5 pb-7">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
