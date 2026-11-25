import { PromoCodesView } from '@/features/consultation/views/promo-codes-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.promoCodes.list.queryOptions());
  return (
    <HydrateClient>
      <PromoCodesView />
    </HydrateClient>
  );
}
