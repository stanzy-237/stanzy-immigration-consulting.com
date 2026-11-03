'use client';

import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FilePlus,
  FolderOpen,
  Lock,
  MessageSquare,
  ReceiptText,
  Upload,
  UserPlus,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useNotificationText } from '@/features/notifications/hooks/use-notification-text';
import {
  notificationHref,
  type Audience,
  type NotificationItem as Item,
} from '@/features/notifications/lib/notification-links';

const ICONS: Record<Item['kind'], LucideIcon> = {
  DOSSIER_OPENED: FolderOpen,
  DOSSIER_STAGE_CHANGED: Waypoints,
  DOSSIER_CLOSED: Lock,
  DOCUMENT_ADDED: FilePlus,
  VERSION_UPLOADED: Upload,
  MESSAGE_POSTED: MessageSquare,
  INVOICE_SENT: ReceiptText,
  INVOICE_PAID: CheckCircle2,
  PROOF_RECEIVED: FileCheck,
  INVOICE_DUE_SOON: CalendarClock,
  INVOICE_OVERDUE: AlarmClock,
  INVOICE_LATE: AlarmClock,
  ACCOUNTS_SIGNED_UP: UserPlus,
};

/**
 * One Notification as a link to its item (#92): its icon, what happened,
 * the message's words or the reason, how long ago, and a dot while unread.
 * Following it calls `onOpen` (which marks it read).
 */
export function NotificationItem({
  item,
  audience,
  onOpen,
}: {
  item: Item;
  audience: Audience;
  onOpen: (item: Item) => void;
}): ReactNode {
  const t = useTranslations('Notifications');
  const format = useFormatter();
  // « il y a 5 min » moves on while the list stays open.
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const text = useNotificationText();
  const { title, detail } = text(item);
  const Icon = ICONS[item.kind];
  const unread = !item.readAt;

  return (
    <Link
      href={notificationHref(item, audience, locale)}
      onClick={() => onOpen(item)}
      className={
        unread
          ? 'flex gap-3 rounded-xl bg-ice-blue/40 px-3 py-2.5 hover:bg-ice-blue'
          : 'flex gap-3 rounded-xl px-3 py-2.5 hover:bg-off-white'
      }
    >
      <span
        aria-hidden={true}
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-navy-deep shadow-sm"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={unread ? 'block text-sm font-semibold text-navy-deep' : 'block text-sm text-navy-deep'}>
          {title}
        </span>
        {detail ? <span className="mt-0.5 line-clamp-2 block text-xs text-slate">{detail}</span> : null}
        <span className="mt-0.5 block text-xs text-slate-mute">
          <time dateTime={new Date(item.updatedAt).toISOString()}>{format.relativeTime(item.updatedAt, now)}</time>
          {unread ? <span className="sr-only"> · {t('unread')}</span> : null}
        </span>
      </span>
      {unread ? <span aria-hidden={true} className="mt-2 size-2 shrink-0 rounded-full bg-rouge" /> : null}
    </Link>
  );
}
