import { ServiceEditView } from '@/features/document-services/views/service-edit-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.documentServices.dashboard.get.queryOptions({ id }));
  prefetch(trpc.documentServices.handoff.partner.queryOptions({ serviceId: id }));
  return (
    <HydrateClient>
      <ServiceEditView id={id} />
    </HydrateClient>
  );
}
