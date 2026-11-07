'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DossierNewForm, PreselectedAccount } from '@/features/dossiers/views/dossier-new-view';

/**
 * « Ouvrir un dossier » as a dialog over the page it was opened from (the
 * intercepted route); a direct visit or a refresh shows the page instead.
 * Closing goes back to that page.
 */
export function DossierNewDialogView({ accountId }: { accountId?: string }): ReactNode {
  const t = useTranslations('Dossiers.new');
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold text-navy-deep">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-slate">{t('intro')}</DialogDescription>
        </DialogHeader>
        {accountId ? (
          <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-72 rounded-2xl" />}>
            <PreselectedAccount accountId={accountId} inDialog />
          </QueryBoundary>
        ) : (
          <DossierNewForm initialAccount={null} inDialog />
        )}
      </DialogContent>
    </Dialog>
  );
}
