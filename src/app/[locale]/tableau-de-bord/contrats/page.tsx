import { ContractsDashboardView } from '@/features/contracts/views/contracts-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.contracts.list.queryOptions());
  return (
    <HydrateClient>
      <ContractsDashboardView />
    </HydrateClient>
  );
}
