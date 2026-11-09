import { ServicesInProgressView } from '@/features/document-services/views/services-in-progress-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ service?: string | string[] }> }) {
  const { service } = await searchParams;
  prefetch(trpc.documentServices.dashboard.underWay.queryOptions());
  return (
    <HydrateClient>
      <ServicesInProgressView service={typeof service === 'string' ? service : null} />
    </HydrateClient>
  );
}
