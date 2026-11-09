import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/** `list`: a title, filters and rows (Factures, Dossiers…). `detail`: one item with its tabs and panels (a Dossier). */
export type PageSkeletonVariant = 'list' | 'detail';

/**
 * A whole page while it loads (a route's `loading.tsx`), shown the moment a
 * link is clicked and faded in past 150 ms so a fast page never flashes it.
 * Each page's own skeletons take over once it renders.
 */
export function PageSkeleton({ variant = 'list' }: { variant?: PageSkeletonVariant }): ReactNode {
  const t = useTranslations('Common');
  const detail = variant === 'detail';
  return (
    <div role="status" className="grid animate-skeleton-in grid-cols-1 gap-6">
      <span className="sr-only">{t('pageLoading')}</span>
      <div aria-hidden={true} className="grid grid-cols-1 gap-3">
        {detail ? <Skeleton className="h-4 w-32" /> : null}
        <Skeleton className={detail ? 'h-9 w-72 max-w-full' : 'h-8 w-56 max-w-full'} />
        <Skeleton className={detail ? 'h-4 w-48' : 'h-4 w-80 max-w-full'} />
      </div>
      <div aria-hidden={true} className="flex gap-2 overflow-hidden">
        {Array.from({ length: detail ? 5 : 3 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      {detail ? (
        <>
          <Skeleton aria-hidden={true} className="h-48 w-full rounded-2xl" />
          <Skeleton aria-hidden={true} className="h-32 w-full rounded-2xl" />
        </>
      ) : (
        <div aria-hidden={true} className="grid grid-cols-1 gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}
