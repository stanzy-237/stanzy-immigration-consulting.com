import { InvoicesDashboardListView } from '@/features/invoices/views/invoices-dashboard-list-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.invoices.dashboard.list.queryOptions({ filter: 'ALL' }));
  return (
    <HydrateClient>
      <InvoicesDashboardListView />
    </HydrateClient>
  );
}
