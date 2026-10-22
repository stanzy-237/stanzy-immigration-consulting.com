import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
} from '@/server/trpc/trpc';

/**
 * Seam: `protectedProcedure` through a server-side caller, mounted on a
 * throwaway router the way a feature router would use it.
 */
const router = createTRPCRouter({
  whoAmI: protectedProcedure.query(({ ctx }) => ctx.session.account.id),
});

function callerAs(session: CurrentSession | null) {
  const ctx = {
    prisma: {} as TRPCContext['prisma'],
    headers: new Headers(),
    session,
  } satisfies TRPCContext;
  return createCallerFactory(router)(ctx);
}

const SIGNED_IN = sessionFor();

describe('protectedProcedure', () => {
  it('rejects a call without a session as UNAUTHORIZED', async () => {
    const call = callerAs(null).whoAmI();
    await expect(call).rejects.toBeInstanceOf(TRPCError);
    await expect(call).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('runs the procedure with the signed-in Account on the context', async () => {
    expect(await callerAs(SIGNED_IN).whoAmI()).toBe('acc_1');
  });
});
