import { AccountsDashboardView } from '@/features/accounts/views/accounts-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.accounts.dashboard.list.queryOptions({ query: '', status: 'ALL' }));
  return (
    <HydrateClient>
      <AccountsDashboardView />
    </HydrateClient>
  );
}
