import { financeYear } from '@/features/finances/lib/finance-year';
import { IncomesView } from '@/features/finances/views/incomes-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ annee?: string | string[] }> }) {
  const year = financeYear((await searchParams).annee);
  prefetch(trpc.finances.incomes.list.queryOptions({ year }));
  return (
    <HydrateClient>
      <IncomesView year={year} />
    </HydrateClient>
  );
}
