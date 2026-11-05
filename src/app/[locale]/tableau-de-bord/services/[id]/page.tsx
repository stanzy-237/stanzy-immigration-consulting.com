import { ServiceEditView } from '@/features/document-services/views/service-edit-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.documentServices.dashboard.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <ServiceEditView id={id} />
    </HydrateClient>
  );
}
