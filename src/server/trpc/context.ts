import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * The tRPC request context. Everything a procedure needs that is derived from
 * the incoming request lives here: the Prisma client, the request headers and
 * the signed-in Account's session (null when signed out).
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  return {
    prisma,
    headers: opts.headers,
    session: await getCurrentSession(opts.headers),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
