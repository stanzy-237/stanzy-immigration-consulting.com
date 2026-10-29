import { dashboardListInput } from '@/features/blog/lib/blog-schema';
import { BlogDashboardListView } from '@/features/blog/views/blog-dashboard-list-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.blog.dashboard.list.queryOptions(dashboardListInput('ALL')));
  return (
    <HydrateClient>
      <BlogDashboardListView />
    </HydrateClient>
  );
}
