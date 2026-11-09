import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DossierOverviewView } from '@/features/accompagnement/views/dossier-overview-view';
import { ServiceProgressView } from '@/features/document-services/views/service-progress-view';
import { requireSession } from '@/features/auth/server/guards';
import { MyDossierView } from '@/features/dossiers/views/my-dossier-view';
import { PendingPiecesNoticeView } from '@/features/document-services/views/pending-pieces-notice-view';
import { DossierContractsView } from '@/features/contracts/views/dossier-contracts-view';
import { DossierInvoicesView } from '@/features/invoices/views/dossier-invoices-view';
import { DossierMeetingsView } from '@/features/meetings/views/dossier-meetings-view';
import { getQueryClient, HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dossiers.mySpace' });
  return { title: t('metaTitleDossier'), robots: { index: false } };
}

// Only its own Client reaches a Dossier here; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}` });
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  prefetch(trpc.dossiers.messages.list.queryOptions({ dossierId: id }));
  prefetch(trpc.invoices.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.contracts.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.meetings.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.documentServices.requirements.mine.queryOptions());
  prefetch(trpc.accompagnement.overview.queryOptions({ dossierId: id }));
  prefetch(trpc.documentServices.requirements.forDossier.queryOptions({ dossierId: id }));
  // Awaited: the Dossier's service picks the tab it opens on. A failure shows in the View.
  await getQueryClient().fetchQuery(trpc.dossiers.myDossier.queryOptions({ id })).catch(() => null);
  return (
    <HydrateClient>
      <MyDossierView
        id={id}
        notice={<PendingPiecesNoticeView />}
        overview={
          <>
            <DossierOverviewView dossierId={id} viewer="client" />
            <ServiceProgressView dossierId={id} viewer="client" />
          </>
        }
        invoices={<DossierInvoicesView dossierId={id} viewer="client" />}
        contracts={<DossierContractsView dossierId={id} viewer="client" />}
        meetings={<DossierMeetingsView dossierId={id} viewer="client" />}
      />
    </HydrateClient>
  );
}
