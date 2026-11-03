import type { NotificationKind } from '@prisma/client';
import { createTranslator } from 'next-intl';

import { notificationHref, type Audience, type LinkTarget } from '@/features/notifications/lib/notification-links';
import type { NotificationTarget } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { appPushSender, type PushSender } from '@/server/push/web-push';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

const MESSAGES = { fr, en } as const;

/** Kinds that already have their own push: a new Tirage goes out as an Alerte tirage. */
const NOT_PUSHED: NotificationKind[] = ['DRAW_PUBLISHED'];

/**
 * Pushes a Notification to the recipient's devices that turned
 * « Recevoir sur ce téléphone » on (#92). The text stays general (no amount,
 * document name or reason on a lock screen), in each device's language; the
 * tap opens the exact item; `tag` (the Notification) makes a grouped repeat
 * replace the first. Expired devices are forgotten. Without VAPID keys, nothing.
 */
export async function pushNotification(
  db: Db,
  notification: {
    id: string;
    kind: NotificationKind;
    recipientId: string;
    audience: Audience;
    target: NotificationTarget;
  },
  send: PushSender | null = appPushSender(),
): Promise<void> {
  if (!send || NOT_PUSHED.includes(notification.kind)) return;
  const devices = await db.pushSubscription.findMany({
    where: { accountId: notification.recipientId, notifications: true },
    select: { endpoint: true, p256dh: true, auth: true, locale: true },
  });
  const link: LinkTarget = {
    kind: notification.kind,
    dossier: notification.target.dossierId ? { id: notification.target.dossierId } : null,
    document: notification.target.documentId ? { id: notification.target.documentId } : null,
    comment: notification.target.commentId ? { id: notification.target.commentId } : null,
    invoice: notification.target.invoiceId ? { id: notification.target.invoiceId } : null,
  };
  const gone: string[] = [];
  for (const device of devices) {
    const locale = toLocale(device.locale);
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Notifications.push' });
    try {
      const result = await send(device, {
        title: 'Stanzy',
        body: t(notification.kind as Exclude<NotificationKind, 'DRAW_PUBLISHED'>),
        url: notificationHref(link, notification.audience, locale),
        tag: notification.id,
      });
      if (result === 'gone') gone.push(device.endpoint);
    } catch (error) {
      console.error('[notifications] a push failed', error);
    }
  }
  if (gone.length > 0) await db.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } });
}
