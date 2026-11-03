import { AccountDashboardView } from '@/features/accounts/views/accounts-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.accounts.dashboard.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <AccountDashboardView id={id} />
    </HydrateClient>
  );
}
