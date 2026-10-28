import { authRouter } from '@/features/auth/server/auth-router';
import { blogRouter } from '@/features/blog/server/blog-router';
import { budgetRouter } from '@/features/budget/server/budget-router';
import { crsRouter } from '@/features/crs/server/crs-router';
import { drawsRouter } from '@/features/draws/server/draws-router';
import { parcoursRouter } from '@/features/parcours/server/parcours-router';

import { healthRouter } from './routers/health';
import { createCallerFactory, createTRPCRouter } from './trpc';

/**
 * The root tRPC router. Feature routers are mounted here as the app grows.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  blog: blogRouter,
  budget: budgetRouter,
  crs: crsRouter,
  draws: drawsRouter,
  health: healthRouter,
  parcours: parcoursRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller, for invoking procedures without an HTTP round-trip (RSCs,
 * tests, background jobs).
 */
export const createCaller = createCallerFactory(appRouter);
