import type { NotificationKind, Prisma } from '@prisma/client';
import { after } from 'next/server';

import { pushNotification } from '@/features/notifications/server/push-notifications';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** What a Notification points to; deleting the Document or the message removes it. */
export type NotificationTarget = { dossierId?: string; documentId?: string; commentId?: string; invoiceId?: string };

export type NotificationEvent = {
  kind: NotificationKind;
  /** Who did it: never notified of their own action. Null for what the app does on its own (a daily reminder). */
  actorId: string | null;
  /** Account ids, or every consultant Account. */
  recipients: string[] | 'CONSULTANTS';
  target: NotificationTarget;
  /** What the text needs beyond the target: a stage key, a closing reason. */
  params?: Record<string, string>;
};

/** Repeats join an unread Notification raised less than this long ago (#92). */
export const GROUP_WINDOW_MS = 30 * 60 * 1000;

/** Which repeats are grouped, and on what: messages and Versions per Document, added Documents per Dossier. */
const GROUP_ON: Partial<Record<NotificationKind, 'documentId' | 'dossierId'>> = {
  MESSAGE_POSTED: 'documentId',
  VERSION_UPLOADED: 'documentId',
  DOCUMENT_ADDED: 'dossierId',
};

/**
 * Raises a Notification for each recipient but the actor. A repeat by the
 * same actor on the same target, while unread and within 30 minutes, raises
 * the count of the existing one and points it at the latest item instead.
 */
export async function notify(db: Db, event: NotificationEvent, now = new Date()): Promise<void> {
  const recipients =
    event.recipients === 'CONSULTANTS'
      ? (await db.account.findMany({ where: { role: 'CONSULTANT' }, select: { id: true } })).map((a) => a.id)
      : event.recipients;
  const params = (event.params ?? {}) as Prisma.InputJsonObject;

  for (const recipientId of new Set(recipients)) {
    if (recipientId === event.actorId) continue;
    const groupOn = GROUP_ON[event.kind];
    const groupValue = groupOn ? event.target[groupOn] : undefined;
    if (groupOn && groupValue) {
      const existing = await db.notification.findFirst({
        where: {
          recipientId,
          kind: event.kind,
          actorId: event.actorId,
          readAt: null,
          [groupOn]: groupValue,
          updatedAt: { gte: new Date(now.getTime() - GROUP_WINDOW_MS) },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (existing) {
        await db.notification.update({
          where: { id: existing.id },
          data: { ...event.target, params, count: { increment: 1 }, updatedAt: now },
        });
        await pushTo(existing.id, recipientId);
        continue;
      }
    }
    const created = await db.notification.create({
      data: { recipientId, kind: event.kind, actorId: event.actorId, ...event.target, params, updatedAt: now },
      select: { id: true },
    });
    await pushTo(created.id, recipientId);
  }

  async function pushTo(id: string, recipientId: string): Promise<void> {
    try {
      await pushNotification(db, {
        id,
        kind: event.kind,
        recipientId,
        // Every consultant-bound event goes to 'CONSULTANTS'; ids name Clients.
        audience: event.recipients === 'CONSULTANTS' ? 'consultant' : 'client',
        target: event.target,
        params: event.params,
      });
    } catch (error) {
      console.error('[notifications] could not push', event.kind, error);
    }
  }
}

/**
 * `notify` after the response, so the click that caused it doesn't wait. A
 * failure is logged: the change itself is already saved.
 */
export function notifyLater(db: Db, event: NotificationEvent): void {
  after(async () => {
    try {
      await notify(db, event);
    } catch (error) {
      console.error('[notifications] could not notify', event.kind, error);
    }
  });
}

/** A message soft-deleted (kept for its replies) takes its Notifications with it; a hard delete cascades. */
export async function forgetComment(db: Db, commentId: string): Promise<void> {
  await db.notification.deleteMany({ where: { commentId } });
}
