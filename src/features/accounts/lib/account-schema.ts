import { z } from 'zod';

export const ACCOUNT_STATUS_FILTERS = ['ALL', 'USER', 'LEAD', 'CLIENT'] as const;
export type AccountStatusFilter = (typeof ACCOUNT_STATUS_FILTERS)[number];

/** How many the list shows at most; the search finds the others. */
export const ACCOUNTS_SHOWN = 100;

export const accountListInput = z.object({
  query: z.string().trim().max(100),
  status: z.enum(ACCOUNT_STATUS_FILTERS),
});
