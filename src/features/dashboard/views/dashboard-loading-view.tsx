import type { ReactNode } from 'react';

import { PageSkeleton, type PageSkeletonVariant } from '@/components/page-skeleton';

/** A Tableau de bord page while it loads, as wide as its pages: the sidebar stays. */
export function DashboardLoadingView({ variant }: { variant?: PageSkeletonVariant }): ReactNode {
  return (
    <div className={variant === 'detail' ? 'mx-auto max-w-5xl' : 'mx-auto max-w-6xl'}>
      <PageSkeleton variant={variant} />
    </div>
  );
}
