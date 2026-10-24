import { authRouter } from '@/features/auth/server/auth-router';
import { crsRouter } from '@/features/crs/server/crs-router';
import { drawsRouter } from '@/features/draws/server/draws-router';

import { healthRouter } from './routers/health';
import { createCallerFactory, createTRPCRouter } from './trpc';

/**
 * The root tRPC router. Feature routers are mounted here as the app grows.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  crs: crsRouter,
  draws: drawsRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller, for invoking procedures without an HTTP round-trip (RSCs,
 * tests, background jobs).
 */
export const createCaller = createCallerFactory(appRouter);
