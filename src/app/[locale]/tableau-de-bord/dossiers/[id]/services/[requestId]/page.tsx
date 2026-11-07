import { RequirementsView } from '@/features/document-services/views/requirements-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { requestId } = await params;
  prefetch(trpc.documentServices.requirements.get.queryOptions({ requestId }));
  return (
    <HydrateClient>
      <RequirementsView requestId={requestId} viewer="consultant" />
    </HydrateClient>
  );
}
