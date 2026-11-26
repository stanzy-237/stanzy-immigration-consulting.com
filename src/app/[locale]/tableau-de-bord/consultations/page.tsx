import { mondayOf } from '@/features/consultation/lib/week-calendar';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { ConsultationsDashboardView } from '@/features/consultation/views/consultations-dashboard-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.consultationAdmin.list.queryOptions({ tab: 'upcoming' }));
  prefetch(trpc.consultationAdmin.settings.queryOptions());
  // The calendar opens on this week: ready if the consultant last chose it.
  prefetch(trpc.consultationAdmin.calendar.queryOptions({ week: mondayOf(doualaDay(new Date())) }));
  return (
    <HydrateClient>
      <ConsultationsDashboardView />
    </HydrateClient>
  );
}
