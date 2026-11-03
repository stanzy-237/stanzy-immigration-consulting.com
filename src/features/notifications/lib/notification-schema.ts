import { z } from 'zod';

export const NOTIFICATION_FILTERS = ['ALL', 'UNREAD'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

/** How many the bell shows; the page loads this many at a time. */
export const BELL_SIZE = 10;
export const PAGE_SIZE = 30;

export const notificationListInput = z.object({
  filter: z.enum(NOTIFICATION_FILTERS),
  limit: z.number().int().min(1).max(50),
  /** The last one already shown: the list continues after it. */
  cursor: z.object({ updatedAt: z.date(), id: z.string().min(1) }).nullish(),
});

export const notificationRefInput = z.object({ id: z.string().min(1) });
