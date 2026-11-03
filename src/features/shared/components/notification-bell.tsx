'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from '@/features/shared/components/notification-item';
import { useMarkRead, useUnreadCount } from '@/features/notifications/hooks/use-notifications';
import type { Audience } from '@/features/notifications/lib/notification-links';
import { BELL_SIZE } from '@/features/notifications/lib/notification-schema';
import { useTRPC } from '@/trpc/client';

/**
 * The bell (#92): the unread count, checked every minute and when the tab
 * comes back, and on click the latest 10 Notifications with « Tout marquer
 * comme lu » and the way to the full page. Opening it marks nothing read.
 */
export function NotificationBell({ audience, enabled = true }: { audience: Audience; enabled?: boolean }): ReactNode {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount(enabled);
  const { markAllRead } = useMarkRead();
  const allHref = audience === 'client' ? `/${locale}/mon-espace/notifications` : '/notifications';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={unread > 0 ? t('bellUnread', { count: unread }) : t('bell')}
        className="relative inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
      >
        <Bell aria-hidden={true} className="size-5" />
        {unread > 0 ? (
          <span
            aria-hidden={true}
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rouge px-1 text-xs leading-none font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-fog-light px-4 py-3">
          <p className="font-heading text-base font-bold text-navy-deep">{t('title')}</p>
          <button
            type="button"
            disabled={unread === 0}
            onClick={() => markAllRead.mutate({})}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rouge hover:text-crimson disabled:text-slate-mute"
          >
            <CheckCheck aria-hidden={true} className="size-3.5" />
            {t('markAllRead')}
          </button>
        </div>
        {open ? <LatestNotifications audience={audience} onOpen={() => setOpen(false)} /> : null}
        <div className="border-t border-fog-light px-4 py-2.5 text-center">
          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-navy-deep hover:text-rouge"
          >
            {t('seeAll')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The latest 10, fetched when the bell opens. */
function LatestNotifications({ audience, onOpen }: { audience: Audience; onOpen: () => void }): ReactNode {
  const t = useTranslations('Notifications');
  const trpc = useTRPC();
  const { markRead } = useMarkRead();
  const { data, isPending } = useQuery(trpc.notifications.list.queryOptions({ filter: 'ALL', limit: BELL_SIZE }));

  if (isPending) {
    return (
      <div role="status" className="grid gap-2 p-3">
        <span className="sr-only">{t('loading')}</span>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} aria-hidden={true} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate">{t('empty')}</p>;
  }
  return (
    <ul className="grid max-h-96 gap-1 overflow-y-auto p-2">
      {data.items.map((item) => (
        <li key={item.id}>
          <NotificationItem
            item={item}
            audience={audience}
            onOpen={(opened) => {
              if (!opened.readAt) markRead.mutate({ id: opened.id });
              onOpen();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
