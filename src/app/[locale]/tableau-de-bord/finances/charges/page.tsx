import { financeYear } from '@/features/finances/lib/finance-year';
import { ChargesView } from '@/features/finances/views/charges-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ annee?: string | string[] }> }) {
  const year = financeYear((await searchParams).annee);
  prefetch(trpc.finances.charges.list.queryOptions({ year }));
  prefetch(trpc.finances.categories.list.queryOptions());
  return (
    <HydrateClient>
      <ChargesView year={year} />
    </HydrateClient>
  );
}
