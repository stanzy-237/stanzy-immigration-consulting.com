'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import superjson from 'superjson';

import type { AppRouter } from '@/server/trpc/root';

import { makeQueryClient } from './query-client';

/**
 * `useTRPC()` gives the option builders for TanStack Query:
 * `useSuspenseQuery(trpc.draws.list.queryOptions())`,
 * `useMutation(trpc.parcours.add.mutationOptions({ onSuccess }))`.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Server: a new client per request, never shared between visitors.
  if (typeof window === 'undefined') return makeQueryClient();
  // Browser: one for the whole visit. Not in useState: React throws state
  // away if the first render suspends, and the cache would go with it.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Client-side tRPC + TanStack Query provider. Wrap the app once. */
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
