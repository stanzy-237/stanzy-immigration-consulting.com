import { ReportsView } from '@/features/reports/views/reports-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.reports.list.queryOptions({}));
  return (
    <HydrateClient>
      <ReportsView />
    </HydrateClient>
  );
}
