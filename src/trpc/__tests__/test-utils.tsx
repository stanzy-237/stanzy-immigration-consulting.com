import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, TRPCClientError, type TRPCLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { observable } from '@trpc/server/observable';

import { Toaster } from '@/components/ui/toast';
import type { AppRouter } from '@/server/trpc/root';
import { TRPCProvider } from '@/trpc/client';

/** A procedure's stand-in: its input in, its result (or a thrown error) out. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each test types its own inputs
type Handler = (input: any) => unknown;
/** Handlers by procedure path: `{ 'parcours.add': (input) => etape }`. */
export type Handlers = Record<string, Handler>;

/** Answers each call from `handlers`; a call without one fails the test loudly. */
function handlerLink(handlers: Handlers): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        const handler = handlers[op.path];
        Promise.resolve()
          .then(() => {
            if (!handler) throw new Error(`No test handler for tRPC "${op.path}"`);
            return handler(op.input);
          })
          .then(
            (data) => {
              observer.next({ result: { type: 'data', data } });
              observer.complete();
            },
            (error: unknown) => observer.error(TRPCClientError.from(error as Error)),
          );
      });
}

/**
 * A tRPC + TanStack Query setup for a component test. `trpc` builds query
 * keys to seed the cache the way a page's server prefetch does
 * (`queryClient.setQueryData(trpc.draws.list.queryKey(), rows)`), so
 * `useSuspenseQuery` reads it on the first render; `handlers` answer what the
 * component asks for afterwards (mutations, refetches). `wrap` also mounts the
 * Toaster, so toasts can be found by their text.
 */
export function createTestTRPC(handlers: Handlers = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const trpcClient = createTRPCClient<AppRouter>({ links: [handlerLink(handlers)] });
  const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
  const wrap = (ui: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <Toaster>{ui}</Toaster>
      </TRPCProvider>
    </QueryClientProvider>
  );
  return { queryClient, trpc, wrap };
}
