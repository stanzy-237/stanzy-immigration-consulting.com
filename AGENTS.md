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

## Design work (Paper + Mobbin)

Product screens are designed in Paper before they are built. The file is **« Stanzy Immgration consulting »** (id `01M7Z4GSEZCG4NR26V5HX4M13S`), page **« Stanzy · Produit »**.

- **Look before you draw.** Search Mobbin (web first, then iOS) for references to the screen, and cite the screens you borrow from to the user.
- **Use the file's tokens and parts.** Colours, fonts, sizes and radii come from the file's tokens (`var(--color-rouge)`, `var(--font-heading)`, …), which match `src/app/globals.css`. Reuse the existing `Site nav` by cloning it. The footer must match `src/features/landing/components/site-footer.tsx` exactly: copy from `fr.json` (`Home.Footer`), links from `data/footer.ts`, assets from `public/`. The `Site footer` on `Consultation · Page · Desktop` is the reference; clone it.
- **Keep the canvas organised.**
  - The canvas is laid out as a grid. Each flow has its own band of rows. Desktop artboards (1440 wide) sit above their mobile artboards (390 wide). Columns are 1640 px apart: x = 0, 1640, 3280, 4920.
  - Name artboards `Section · N Étape · Device`, for example `Paiement · 2 Validez sur le téléphone · Desktop`.
  - Variations of an existing screen go in the same row, to its right, named `… · Variante A — <idée>`. Don't move or overwrite the original.
  - A long page (e.g. `Consultation · Page`) keeps its mobile version **beside** the desktop one, in the next column, with variants after it. The row's height is set by the tallest artboard in it.
  - Set artboards to `height: fit-content`. Never let them overlap. If an artboard grows, move every section below it down by the same amount (headers `N.N — titre/nombre/ligne` included) so the gaps stay as they were.
- **No invented facts.** Use `XX XXX FCFA` for prices (prices live only in the dashboard catalogue) and `XXX` for figures. Label sample reviews as examples.
- **Desktop first, then mobile — but mobile is its own design.** Never shrink the desktop layout. Search Mobbin with platform `ios` first, then use mobile patterns: one step per screen, bottom sheets for choices, the main action in a bottom bar, large tap targets, short copy.
