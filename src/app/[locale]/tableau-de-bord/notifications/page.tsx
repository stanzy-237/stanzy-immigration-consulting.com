import { PAGE_SIZE } from '@/features/notifications/lib/notification-schema';
import { NotificationsView } from '@/features/notifications/views/notifications-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.notifications.unreadCount.queryOptions());
  prefetch(
    trpc.notifications.list.infiniteQueryOptions(
      { filter: 'ALL', limit: PAGE_SIZE },
      { getNextPageParam: (page) => page.next },
    ),
  );
  return (
    <HydrateClient>
      <NotificationsView audience="consultant" />
    </HydrateClient>
  );
}
