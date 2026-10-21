'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from '@/i18n/navigation';

type AuthDialogProps = {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * An auth screen opened over the current page by an intercepted route
 * (`@modal/(.)connexion`, …). Closing it steps back in history, which
 * returns to the page underneath and leaves the URL as it was.
 */
export function AuthDialog({ title, subtitle, footer, children }: AuthDialogProps): ReactNode {
  const router = useRouter();
  return (
    <Dialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-h-dvh gap-6 overflow-y-auto p-6 sm:max-w-md md:p-8">
        <DialogHeader>
          <DialogTitle className="font-heading text-navy-deep text-2xl font-bold">
            {title}
          </DialogTitle>
          {subtitle ? (
            <DialogDescription className="text-slate text-sm">{subtitle}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer ? <p className="text-slate text-center text-sm">{footer}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
