import { ServiceOrdersView } from '@/features/document-services/views/service-orders-view';
import { ServicesInProgressView } from '@/features/document-services/views/services-in-progress-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ service?: string | string[] }> }) {
  const { service } = await searchParams;
  prefetch(trpc.documentServices.dashboard.underWay.queryOptions());
  prefetch(trpc.documentServices.dashboard.list.queryOptions());
  prefetch(trpc.documentServices.orders.dashboard.list.queryOptions({ filter: 'SUBMITTED' }));
  return (
    <HydrateClient>
      <ServicesInProgressView orders={<ServiceOrdersView />} service={typeof service === 'string' ? service : null} />
    </HydrateClient>
  );
}
