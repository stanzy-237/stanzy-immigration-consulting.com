import { SignaturesDashboardView } from '@/features/signatures/views/signatures-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.signatures.assets.queryOptions());
  prefetch(trpc.signatures.pending.queryOptions());
  return (
    <HydrateClient>
      <SignaturesDashboardView />
    </HydrateClient>
  );
}
