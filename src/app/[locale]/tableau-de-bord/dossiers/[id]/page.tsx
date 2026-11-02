import { DossierDashboardView } from '@/features/dossiers/views/dossier-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.dossiers.dashboard.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <DossierDashboardView id={id} />
    </HydrateClient>
  );
}
