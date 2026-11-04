import { InterestDashboardView } from '@/features/accompagnement/views/interest-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.accompagnement.dashboard.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <InterestDashboardView id={id} />
    </HydrateClient>
  );
}
