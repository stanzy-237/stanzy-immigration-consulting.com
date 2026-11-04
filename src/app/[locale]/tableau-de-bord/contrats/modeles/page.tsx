import { ContractTemplatesView } from '@/features/contracts/views/contract-templates-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.contracts.templates.list.queryOptions());
  return (
    <HydrateClient>
      <ContractTemplatesView />
    </HydrateClient>
  );
}
