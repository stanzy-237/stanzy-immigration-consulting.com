import { prisma } from '@/server/db/client';

/**
 * The tRPC request context. Everything a procedure needs that is derived from
 * the incoming request lives here. For now that is the Prisma client and the
 * request headers; auth (#4) will add the current Account.
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  return {
    prisma,
    headers: opts.headers,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
