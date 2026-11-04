import { authRouter } from '@/features/auth/server/auth-router';
import { blogRouter } from '@/features/blog/server/blog-router';
import { budgetRouter } from '@/features/budget/server/budget-router';
import { checklistRouter } from '@/features/checklist/server/checklist-router';
import { crsRouter } from '@/features/crs/server/crs-router';
import { accountsRouter } from '@/features/accounts/server/accounts-router';
import { contractsRouter } from '@/features/contracts/server/contracts-router';
import { invoicesRouter } from '@/features/invoices/server/invoices-router';
import { meetingsRouter } from '@/features/meetings/server/meetings-router';
import { pdfToolsRouter } from '@/features/pdf-tools/server/history-router';
import { notificationsRouter } from '@/features/notifications/server/notifications-router';
import { dossiersRouter } from '@/features/dossiers/server/dossiers-router';
import { drawsRouter } from '@/features/draws/server/draws-router';
import { parcoursRouter } from '@/features/parcours/server/parcours-router';
import { signaturesRouter } from '@/features/signatures/server/signatures-router';

import { healthRouter } from './routers/health';
import { createCallerFactory, createTRPCRouter } from './trpc';

/**
 * The root tRPC router. Feature routers are mounted here as the app grows.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  blog: blogRouter,
  budget: budgetRouter,
  checklist: checklistRouter,
  contracts: contractsRouter,
  crs: crsRouter,
  dossiers: dossiersRouter,
  accounts: accountsRouter,
  invoices: invoicesRouter,
  meetings: meetingsRouter,
  notifications: notificationsRouter,
  pdfTools: pdfToolsRouter,
  draws: drawsRouter,
  health: healthRouter,
  parcours: parcoursRouter,
  signatures: signaturesRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller, for invoking procedures without an HTTP round-trip (RSCs,
 * tests, background jobs).
 */
export const createCaller = createCallerFactory(appRouter);
