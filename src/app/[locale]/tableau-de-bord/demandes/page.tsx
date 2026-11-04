import { InterestsDashboardView } from '@/features/accompagnement/views/interests-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.accompagnement.dashboard.list.queryOptions({ filter: 'SUBMITTED' }));
  return (
    <HydrateClient>
      <InterestsDashboardView />
    </HydrateClient>
  );
}
