import { financeYear } from '@/features/finances/lib/finance-year';
import { FinancesOverviewView } from '@/features/finances/views/finances-overview-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ annee?: string | string[] }> }) {
  const year = financeYear((await searchParams).annee);
  prefetch(trpc.finances.overview.queryOptions({ year }));
  return (
    <HydrateClient>
      <FinancesOverviewView year={year} />
    </HydrateClient>
  );
}
