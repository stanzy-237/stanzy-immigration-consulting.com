import { InvoiceDashboardView } from '@/features/invoices/views/invoice-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.invoices.dashboard.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <InvoiceDashboardView id={id} />
    </HydrateClient>
  );
}
