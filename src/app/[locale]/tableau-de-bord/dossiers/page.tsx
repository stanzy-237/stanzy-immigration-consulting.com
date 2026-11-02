import { DossiersDashboardListView } from '@/features/dossiers/views/dossiers-dashboard-list-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.dossiers.dashboard.list.queryOptions({ state: 'OPEN' }));
  return (
    <HydrateClient>
      <DossiersDashboardListView />
    </HydrateClient>
  );
}
