import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';

/** How often the bell checks for new Notifications; it also checks when the tab comes back (#92). */
export const POLL_MS = 60_000;

/** The unread count for the bell's badge, polled. `enabled` is false until someone is signed in. */
export function useUnreadCount(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Marking read changes the screen at once: the item loses its dot and the
 * badge drops, then every Notification query refetches.
 */
export function useMarkRead() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const all = trpc.notifications.pathKey();
  const settle = () => queryClient.invalidateQueries({ queryKey: all });

  const markRead = useMutation(
    trpc.notifications.markRead.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: all });
        queryClient.setQueriesData<{ items: { id: string; readAt: Date | null }[] }>(
          { queryKey: trpc.notifications.list.pathKey() },
          (page) => markIn(page, (item) => item.id === id),
        );
        queryClient.setQueryData(trpc.notifications.unreadCount.queryKey(), (count?: number) =>
          Math.max(0, (count ?? 0) - 1),
        );
      },
      onSettled: settle,
    }),
  );
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: all });
        queryClient.setQueriesData<{ items: { id: string; readAt: Date | null }[] }>(
          { queryKey: trpc.notifications.list.pathKey() },
          (page) => markIn(page, () => true),
        );
        queryClient.setQueryData(trpc.notifications.unreadCount.queryKey(), 0);
      },
      onSettled: settle,
    }),
  );
  return { markRead, markAllRead };
}

type Page = { items: { id: string; readAt: Date | null }[] };

/** Marks the matching unread items read, in a list page or in every page of an infinite list. */
function markIn<T>(data: T, matches: (item: { id: string }) => boolean): T {
  if (!data || typeof data !== 'object') return data;
  const mark = (page: Page): Page => ({
    ...page,
    items: page.items.map((item) => (!item.readAt && matches(item) ? { ...item, readAt: new Date() } : item)),
  });
  if ('pages' in data && Array.isArray((data as { pages: unknown }).pages)) {
    return { ...data, pages: (data as unknown as { pages: Page[] }).pages.map(mark) } as T;
  }
  if ('items' in data) return mark(data as unknown as Page) as T;
  return data;
}
