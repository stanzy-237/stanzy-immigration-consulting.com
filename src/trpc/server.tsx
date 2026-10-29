import 'server-only';

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createTRPCOptionsProxy, type TRPCQueryOptions } from '@trpc/tanstack-react-query';
import { headers } from 'next/headers';
import { cache } from 'react';

import { createTRPCContext, type TRPCContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';
import { prisma } from '@/server/db/client';

import { makeQueryClient } from './query-client';

/** One QueryClient per request: every prefetch of a page lands in the same cache. */
export const getQueryClient = cache(makeQueryClient);

/**
 * Prefetch with the visitor's session (`protectedProcedure`, `consultantProcedure`).
 * Reading the request makes the page render per visit: use it on pages that
 * already do (behind `requireSession` / `requireConsultant`).
 */
export const trpc = createTRPCOptionsProxy({
  ctx: cache(async () => createTRPCContext({ headers: new Headers(await headers()) })),
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * Prefetch `publicProcedure`s without reading the request, so a static page
 * stays static (pair it with `export const revalidate`). No session: a
 * protected procedure called through it is `UNAUTHORIZED`.
 */
export const publicTrpc = createTRPCOptionsProxy({
  ctx: (): TRPCContext => ({ prisma, headers: new Headers(), session: null }),
  router: appRouter,
  queryClient: getQueryClient,
});

/** Hands the request's prefetched queries to the client components below it. */
export function HydrateClient({ children }: { children: React.ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}

/**
 * Starts a query on the server without waiting for it: the page streams and
 * the client's `useSuspenseQuery` picks the result up through `HydrateClient`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any procedure's options
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrowed by the key's type
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
