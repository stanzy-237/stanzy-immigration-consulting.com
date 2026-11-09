import type { ReactNode } from 'react';

import { PageSkeleton, type PageSkeletonVariant } from '@/components/page-skeleton';
import { SiteNav } from '@/features/landing/components/site-nav';

/**
 * A « Mon espace » page while it loads. Its pages draw the site's menu
 * themselves, so the menu stays here too and doesn't blink on a click.
 */
export function MySpaceLoadingView({ variant }: { variant?: PageSkeletonVariant }): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <PageSkeleton variant={variant} />
        </div>
      </main>
    </>
  );
}
