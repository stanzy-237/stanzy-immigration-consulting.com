import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ACCOUNTS_SHOWN, accountListInput } from '@/features/accounts/lib/account-schema';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

const accountFields = { id: true, name: true, email: true, status: true, locale: true, createdAt: true } as const;

/**
 * The « Comptes » list of the Tableau de bord (#92): every Account but the
 * consultant's, read-only, for the consultant only.
 */
export const accountsRouter = createTRPCRouter({
  dashboard: createTRPCRouter({
    /** Newest first, at most ACCOUNTS_SHOWN, by name or email and status. */
    list: consultantProcedure.input(accountListInput).query(async ({ ctx, input }) => {
      const where = {
        role: { not: 'CONSULTANT' as const },
        ...(input.status === 'ALL' ? {} : { status: input.status }),
        ...(input.query
          ? {
              OR: [
                { name: { contains: input.query, mode: 'insensitive' as const } },
                { email: { contains: input.query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [accounts, total] = await Promise.all([
        ctx.prisma.account.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: ACCOUNTS_SHOWN,
          select: accountFields,
        }),
        ctx.prisma.account.count({ where }),
      ]);
      return { accounts, total };
    }),

    /** One Account with its Dossiers, newest first. */
    get: consultantProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
      const account = await ctx.prisma.account.findFirst({
        where: { id: input.id, role: { not: 'CONSULTANT' } },
        select: {
          ...accountFields,
          dossiers: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, service: true, stage: true, state: true, createdAt: true },
          },
        },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND' });
      return account;
    }),
  }),
});
