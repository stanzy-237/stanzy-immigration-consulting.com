import { DossierOverviewView } from '@/features/accompagnement/views/dossier-overview-view';
import { ServiceProgressView } from '@/features/document-services/views/service-progress-view';
import { DossierStanzyView } from '@/features/accompagnement/views/dossier-stanzy-view';
import { DossierDashboardView } from '@/features/dossiers/views/dossier-dashboard-view';
import { DossierContractsView } from '@/features/contracts/views/dossier-contracts-view';
import { DossierFinancesView } from '@/features/finances/views/dossier-finances-view';
import { DossierInvoicesView } from '@/features/invoices/views/dossier-invoices-view';
import { DossierMeetingsView } from '@/features/meetings/views/dossier-meetings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.dossiers.dashboard.get.queryOptions({ id }));
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  prefetch(trpc.dossiers.messages.list.queryOptions({ dossierId: id }));
  prefetch(trpc.invoices.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.finances.dossier.queryOptions({ dossierId: id }));
  prefetch(trpc.contracts.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.accompagnement.stanzy.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.accompagnement.overview.queryOptions({ dossierId: id }));
  prefetch(trpc.documentServices.requirements.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.meetings.forDossier.queryOptions({ dossierId: id }));
  return (
    <HydrateClient>
      <DossierDashboardView
        id={id}
        overview={
          <>
            <DossierOverviewView dossierId={id} viewer="consultant" />
            <ServiceProgressView dossierId={id} viewer="consultant" />
          </>
        }
        invoices={<DossierInvoicesView dossierId={id} viewer="consultant" />}
        finances={<DossierFinancesView dossierId={id} />}
        contracts={<DossierContractsView dossierId={id} viewer="consultant" />}
        meetings={<DossierMeetingsView dossierId={id} viewer="consultant" />}
        stanzy={<DossierStanzyView dossierId={id} />}
      />
    </HydrateClient>
  );
}
