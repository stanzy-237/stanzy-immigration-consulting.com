import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/server/trpc/root';

/** What a procedure takes: `RouterInputs['parcours']['add']`. */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** What a procedure returns: `RouterOutputs['blog']['dashboard']['get']`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
