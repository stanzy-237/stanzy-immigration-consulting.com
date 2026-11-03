'use client';

import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from '@/features/shared/components/notification-item';
import { useMarkRead, useUnreadCount } from '@/features/notifications/hooks/use-notifications';
import type { Audience, NotificationItem as Item } from '@/features/notifications/lib/notification-links';
import {
  NOTIFICATION_FILTERS,
  PAGE_SIZE,
  type NotificationFilter,
} from '@/features/notifications/lib/notification-schema';
import { useTRPC } from '@/trpc/client';

/**
 * Every Notification of the signed-in Account (#92): « Toutes » or « Non
 * lues », grouped by day, newest first, `PAGE_SIZE` at a time.
 */
export function NotificationsView({ audience }: { audience: Audience }): ReactNode {
  const t = useTranslations('Notifications');
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  // The current list stays on screen while the other filter's loads.
  const [, startTransition] = useTransition();
  const { data: unread = 0 } = useUnreadCount(true);
  const { markAllRead } = useMarkRead();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
        <button
          type="button"
          disabled={unread === 0}
          onClick={() => markAllRead.mutate({})}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50"
        >
          <CheckCheck aria-hidden={true} className="size-4" />
          {t('markAllRead')}
        </button>
      </div>

      <div role="group" aria-label={t('filtersLabel')} className="mb-5 flex gap-2">
        {NOTIFICATION_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => startTransition(() => setFilter(value))}
            className="inline-flex h-9 items-center rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep aria-pressed:border-navy-deep aria-pressed:bg-navy-deep aria-pressed:text-white"
          >
            {value === 'UNREAD' ? t('filters.UNREAD', { count: unread }) : t('filters.ALL')}
          </button>
        ))}
      </div>

      <QueryBoundary fallback={<NotificationsSkeleton />}>
        <NotificationList audience={audience} filter={filter} />
      </QueryBoundary>
    </div>
  );
}

function NotificationList({ audience, filter }: { audience: Audience; filter: NotificationFilter }): ReactNode {
  const t = useTranslations('Notifications');
  const trpc = useTRPC();
  const { markRead } = useMarkRead();
  // The same options as the route's prefetch, so the first page comes hydrated.
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    trpc.notifications.list.infiniteQueryOptions(
      { filter, limit: PAGE_SIZE },
      { getNextPageParam: (page) => page.next },
    ),
  );
  const items = data.pages.flatMap((page) => page.items);
  const days = byDay(items);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">
        {filter === 'UNREAD' ? t('emptyUnread') : t('empty')}
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {days.map(({ day, items: ofDay }) => (
        <section key={day.toISOString()} aria-labelledby={`day-${day.getTime()}`}>
          <DayHeading day={day} />
          <ul className="mt-2 grid gap-1 rounded-2xl border border-fog-light bg-white p-2 shadow-sm">
            {ofDay.map((item) => (
              <li key={item.id}>
                <NotificationItem
                  item={item}
                  audience={audience}
                  onOpen={(opened) => {
                    if (!opened.readAt) markRead.mutate({ id: opened.id });
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hasNextPage ? (
        <button
          type="button"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          className="mx-auto inline-flex h-11 items-center rounded-full border-2 border-fog-light bg-white px-5 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50"
        >
          {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </button>
      ) : null}
    </div>
  );
}

/** « Aujourd'hui », « Hier », then the date. */
function DayHeading({ day }: { day: Date }): ReactNode {
  const t = useTranslations('Notifications');
  const format = useFormatter();
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const label =
    day.getTime() === today.getTime()
      ? t('today')
      : day.getTime() === yesterday.getTime()
        ? t('yesterday')
        : format.dateTime(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <h2 id={`day-${day.getTime()}`} className="text-xs font-semibold tracking-wider text-slate uppercase">
      {label}
    </h2>
  );
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Consecutive items of the same day, in order. */
function byDay(items: Item[]): { day: Date; items: Item[] }[] {
  const groups: { day: Date; items: Item[] }[] = [];
  for (const item of items) {
    const day = startOfDay(new Date(item.updatedAt));
    const last = groups.at(-1);
    if (last && last.day.getTime() === day.getTime()) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

function NotificationsSkeleton(): ReactNode {
  const t = useTranslations('Notifications');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
