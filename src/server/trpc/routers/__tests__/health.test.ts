import { describe, expect, it } from 'vitest';

import { createCaller } from '@/server/trpc/root';
import type { TRPCContext } from '@/server/trpc/context';

/**
 * Seam: the tRPC `health` router exercised through a server-side caller.
 * Verifies the router/context/transformer wiring without a live database or
 * HTTP transport.
 */
function callerWithStubContext() {
  const ctx = {
    prisma: {} as TRPCContext['prisma'],
    headers: new Headers(),
    session: null,
  } satisfies TRPCContext;
  return createCaller(ctx);
}

describe('health router', () => {
  it('reports an ok status', async () => {
    const caller = callerWithStubContext();
    const result = await caller.health.status();
    expect(result.status).toBe('ok');
  });

  it('includes a current timestamp', async () => {
    const before = Date.now();
    const caller = callerWithStubContext();
    const result = await caller.health.status();
    const after = Date.now();
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(after);
  });
});
