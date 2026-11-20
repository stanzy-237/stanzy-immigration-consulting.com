import { z } from 'zod';

export const REPORT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;

/** « Signaler un problème »: what happened, where, and the tab's latest Rollbar items. */
export const createReportInput = z.object({
  message: z.string().trim().min(MESSAGE_MIN).max(MESSAGE_MAX),
  // A path on this site, without its query string (it may hold a token).
  path: z
    .string()
    .max(300)
    .regex(/^\/[^?#\s]*$/),
  rollbarIds: z.array(z.string().uuid()).max(5).default([]),
});
export type CreateReportInput = z.input<typeof createReportInput>;

export const setReportStatusInput = z.object({ id: z.string().min(1), status: z.enum(REPORT_STATUSES) });

export const listReportsInput = z.object({ status: z.enum(REPORT_STATUSES).optional() }).default({});

/** The path of `url`, without its query string or hash. */
export const pathOf = (url: string): string => {
  try {
    return new URL(url, 'https://stanzy.local').pathname.slice(0, 300);
  } catch {
    return '/';
  }
};
