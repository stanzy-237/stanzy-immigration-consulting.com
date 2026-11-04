import { DossierDashboardView } from '@/features/dossiers/views/dossier-dashboard-view';
import { DossierContractsView } from '@/features/contracts/views/dossier-contracts-view';
import { DossierInvoicesView } from '@/features/invoices/views/dossier-invoices-view';
import { DossierMeetingsView } from '@/features/meetings/views/dossier-meetings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.dossiers.dashboard.get.queryOptions({ id }));
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  prefetch(trpc.invoices.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.contracts.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.meetings.forDossier.queryOptions({ dossierId: id }));
  return (
    <HydrateClient>
      <DossierDashboardView
        id={id}
        invoices={<DossierInvoicesView dossierId={id} viewer="consultant" />}
        contracts={<DossierContractsView dossierId={id} viewer="consultant" />}
        meetings={<DossierMeetingsView dossierId={id} viewer="consultant" />}
      />
    </HydrateClient>
  );
}
