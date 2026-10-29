<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Data fetching (mandatory)

Features read and write data through tRPC + TanStack Query, after `code-with-antonio/resonance`. Read `docs/agents/data-fetching.md` before writing a View or component that calls tRPC. In short:

- **Prefetch in the route.** `page.tsx` calls `prefetch(publicTrpc.x.queryOptions(input))` (public, keeps the page static, with `revalidate`) or `prefetch(trpc.x.queryOptions(input))` (behind `requireSession` / `requireConsultant`), then renders `<HydrateClient><FeatureView /></HydrateClient>` (ADR 0006).
- **Read with `useSuspenseQuery`** from `useTRPC()` (`@/trpc/client`), under a `<QueryBoundary fallback={<…Skeleton />}>`.
- **Skeletons, never « Chargement… ».** While content loads, show `Skeleton` blocks shaped like it.
- **Toasts for outcomes.** Mutations invalidate what they changed and call `toast.add({ title, type: 'success' | 'deleted' | 'error' | 'warning' | 'info' })` (each kind has its colour and icon) with a translated title. Field errors stay under their field.
- **Optimistic lists.** Adding, editing, deleting in a User's own list (Étapes, Dépenses) updates the cache at once with `optimisticList` (`src/lib/optimistic-list.ts`), closes the form, rolls back and toasts on a refusal.
- **Prefetch the next tab** (`queryClient.prefetchQuery`) when it is one tap away.
- **Tests** use `createTestTRPC` (`src/trpc/__tests__/test-utils.tsx`): seed the cache as the prefetch would, answer calls with handlers, find toasts by their text.
