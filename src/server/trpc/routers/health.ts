import { createTRPCRouter, publicProcedure } from '../trpc';

/**
 * Liveness probe. A dependency-free query used to confirm the API is reachable
 * and the tRPC pipeline is wired correctly (e.g. from monitoring or a smoke
 * test after deploy).
 */
export const healthRouter = createTRPCRouter({
  status: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date(),
  })),
});
