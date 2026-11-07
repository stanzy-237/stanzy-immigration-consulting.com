import { ClientFormView } from '@/features/client-forms/views/client-form-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { documentId } = await params;
  prefetch(trpc.clientForms.get.queryOptions({ documentId }));
  return (
    <HydrateClient>
      <ClientFormView documentId={documentId} viewer="consultant" />
    </HydrateClient>
  );
}
