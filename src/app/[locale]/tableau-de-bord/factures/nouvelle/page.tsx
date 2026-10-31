import { InvoiceNewView } from '@/features/invoices/views/invoice-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

// `?dossier=<id>` when started from a Dossier's page: its Client is already chosen.
export default async function Page({ searchParams }: { searchParams: Promise<{ dossier?: string }> }) {
  const { dossier } = await searchParams;
  if (dossier) prefetch(trpc.invoices.dashboard.dossierOption.queryOptions({ id: dossier }));
  return (
    <HydrateClient>
      <InvoiceNewView dossierId={dossier} />
    </HydrateClient>
  );
}
