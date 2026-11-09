import { ServicesDashboardView } from '@/features/document-services/views/services-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.documentServices.dashboard.list.queryOptions());
  return (
    <HydrateClient>
      <ServicesDashboardView />
    </HydrateClient>
  );
}
