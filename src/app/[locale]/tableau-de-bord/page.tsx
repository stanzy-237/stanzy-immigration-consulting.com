import { DashboardOverviewView } from '@/features/dashboard/views/dashboard-overview-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.blog.dashboard.summary.queryOptions());
  return (
    <HydrateClient>
      <DashboardOverviewView />
    </HydrateClient>
  );
}
