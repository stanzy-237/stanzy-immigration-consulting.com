import { z } from 'zod';

import { invoiceTotal } from '@/features/invoices/lib/money';
import { notificationListInput, notificationRefInput } from '@/features/notifications/lib/notification-schema';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const fields = {
  id: true,
  kind: true,
  count: true,
  params: true,
  readAt: true,
  updatedAt: true,
  actor: { select: { name: true, role: true } },
  dossier: { select: { id: true, service: true } },
  document: { select: { id: true, title: true } },
  comment: { select: { id: true, body: true, deletedAt: true } },
  invoice: {
    select: { id: true, number: true, currency: true, lines: { select: { quantity: true, unitAmount: true } } },
  },
} as const;

/**
 * The signed-in Account's Notifications (#92, GLOSSARY: Notification). Each
 * Account reads and marks only its own; nobody else's is reachable.
 */
export const notificationsRouter = createTRPCRouter({
  /** What the bell's badge shows. */
  unreadCount: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.notification.count({ where: { recipientId: ctx.session.account.id, readAt: null } }),
  ),

  /** Newest first (by when each was last raised), `limit` at a time after `cursor`. */
  list: protectedProcedure.input(notificationListInput).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.notification.findMany({
      where: {
        recipientId: ctx.session.account.id,
        ...(input.filter === 'UNREAD' ? { readAt: null } : {}),
        ...(input.cursor
          ? {
              OR: [
                { updatedAt: { lt: input.cursor.updatedAt } },
                { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: fields,
    });
    const items = rows.slice(0, input.limit).map(({ invoice, comment, params, ...row }) => ({
      ...row,
      params: (params ?? {}) as Record<string, string>,
      // A deleted message keeps no words; an edited one shows its latest.
      comment: comment ? { id: comment.id, body: comment.deletedAt ? '' : comment.body } : null,
      invoice: invoice
        ? { id: invoice.id, number: invoice.number, currency: invoice.currency, total: invoiceTotal(invoice.lines) }
        : null,
    }));
    const last = items.at(-1);
    return {
      items,
      next: rows.length > input.limit && last ? { updatedAt: last.updatedAt, id: last.id } : null,
    };
  }),

  markRead: protectedProcedure.input(notificationRefInput).mutation(async ({ ctx, input }) => {
    await ctx.prisma.notification.updateMany({
      where: { id: input.id, recipientId: ctx.session.account.id, readAt: null },
      data: { readAt: new Date() },
    });
  }),

  markAllRead: protectedProcedure.input(z.object({}).optional()).mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { recipientId: ctx.session.account.id, readAt: null },
      data: { readAt: new Date() },
    });
  }),
});
