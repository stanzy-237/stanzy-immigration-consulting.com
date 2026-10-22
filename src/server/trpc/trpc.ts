import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

import { hasStatusAtLeast, type AccountStatus } from '@/features/auth/lib/account-status';

import type { TRPCContext } from './context';

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/**
 * Signed-in only. Rejects calls without a session as `UNAUTHORIZED`; inside
 * the procedure `ctx.session` is non-null.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** The consultant only (ADR 0002). Members get `FORBIDDEN`, even Clients. */
export const consultantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.account.role !== 'CONSULTANT') throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});

/**
 * Accounts at `min` or further along USER < LEAD < CLIENT, else `FORBIDDEN`.
 * The consultant passes every status check: they are never "a Client" but
 * must reach what Clients reach.
 */
export function statusProcedure(min: AccountStatus) {
  return protectedProcedure.use(({ ctx, next }) => {
    const { role, status } = ctx.session.account;
    if (role !== 'CONSULTANT' && !hasStatusAtLeast(status, min)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });
}
