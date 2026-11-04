import { financeYear } from '@/features/finances/lib/finance-year';
import { FinanceSettingsView } from '@/features/finances/views/finance-settings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ annee?: string | string[] }> }) {
  const year = financeYear((await searchParams).annee);
  prefetch(trpc.finances.categories.list.queryOptions());
  prefetch(trpc.finances.rates.list.queryOptions({ year }));
  return (
    <HydrateClient>
      <FinanceSettingsView year={year} />
    </HydrateClient>
  );
}
