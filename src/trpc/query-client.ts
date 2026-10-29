import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

/**
 * One QueryClient's defaults, shared by the server (prefetch) and the browser.
 * Pending queries are dehydrated too, so a page streams while its prefetch is
 * still running instead of waiting for it; superjson carries Dates across.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data prefetched on the server is fresh for 30 s: the browser doesn't
        // ask for it again right after hydrating.
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
