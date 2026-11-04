import { SignatureRequestNewView } from '@/features/signatures/views/signature-request-new-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  prefetch(trpc.signatures.assets.queryOptions());
  return (
    <HydrateClient>
      <SignatureRequestNewView dossierId={id} />
    </HydrateClient>
  );
}
