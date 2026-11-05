import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DossierOverviewView } from '@/features/accompagnement/views/dossier-overview-view';
import { requireSession } from '@/features/auth/server/guards';
import { MyDossierView } from '@/features/dossiers/views/my-dossier-view';
import { DossierContractsView } from '@/features/contracts/views/dossier-contracts-view';
import { DossierInvoicesView } from '@/features/invoices/views/dossier-invoices-view';
import { DossierMeetingsView } from '@/features/meetings/views/dossier-meetings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

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
  prefetch(trpc.dossiers.myDossier.queryOptions({ id }));
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  prefetch(trpc.dossiers.messages.list.queryOptions({ dossierId: id }));
  prefetch(trpc.invoices.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.contracts.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.meetings.forDossier.queryOptions({ dossierId: id }));
  prefetch(trpc.accompagnement.overview.queryOptions({ dossierId: id }));
  return (
    <HydrateClient>
      <MyDossierView
        id={id}
        overview={<DossierOverviewView dossierId={id} viewer="client" />}
        invoices={<DossierInvoicesView dossierId={id} viewer="client" />}
        contracts={<DossierContractsView dossierId={id} viewer="client" />}
        meetings={<DossierMeetingsView dossierId={id} viewer="client" />}
      />
    </HydrateClient>
  );
}
