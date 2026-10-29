'use client';

import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@/server/trpc/root';

/**
 * The previous hooks (`api.x.useQuery()`), kept while features move to
 * `useTRPC()` (see `docs/agents/data-fetching.md`). Removed with the last one.
 */
export const api = createTRPCReact<AppRouter>();
