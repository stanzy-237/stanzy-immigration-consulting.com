import { ConsultationsDashboardView } from '@/features/consultation/views/consultations-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.consultationAdmin.list.queryOptions({ tab: 'upcoming' }));
  prefetch(trpc.consultationAdmin.settings.queryOptions());
  return (
    <HydrateClient>
      <ConsultationsDashboardView />
    </HydrateClient>
  );
}
