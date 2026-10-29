# Data fetching, loading and feedback

How a feature reads and writes data through tRPC, what it shows while waiting, and how it tells the visitor what happened. The pattern follows [`code-with-antonio/resonance`](https://github.com/code-with-antonio/resonance) (`src/trpc/`). Every agent MUST follow this when a feature calls tRPC. Why routes may prefetch: [ADR 0006](../adr/0006-prefetch-in-route-shells.md).

## The pieces

| File | Side | Gives |
|---|---|---|
| `src/trpc/query-client.ts` | both | `makeQueryClient()`: 30 s `staleTime`, superjson, pending queries dehydrated |
| `src/trpc/server.tsx` | server | `prefetch()`, `<HydrateClient>`, `trpc` (with the visitor's session), `publicTrpc` (no session, keeps a page static), `getQueryClient()` |
| `src/trpc/client.tsx` | browser | `useTRPC()`, `TRPCReactProvider` (mounted once in `[locale]/layout.tsx`) |
| `src/components/query-boundary.tsx` | browser | `<QueryBoundary fallback={<Skeleton />}>`: Suspense + « Réessayer » on error |
| `src/components/ui/skeleton.tsx` | browser | `<Skeleton className="h-6 w-40" />` |
| `src/components/ui/toast.tsx` | browser | `toast.add({ title, type })`; the `<Toaster>` is mounted in the layout |
| `src/trpc/__tests__/test-utils.tsx` | tests | `createTestTRPC(handlers)`: seed the cache, answer calls, find toasts |

## 1. Prefetch in the route, read with `useSuspenseQuery` in the View

The route starts every query its View reads, with the **same input**, and wraps the View:

```tsx
// src/app/[locale]/outils/dernier-tirage/page.tsx
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';

export const revalidate = 300; // a static page with prefetched data: refresh it

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(publicTrpc.draws.list.queryOptions());
  prefetch(publicTrpc.draws.latest.queryOptions({ take: 1 }));
  return (
    <HydrateClient>
      <DrawsView />
    </HydrateClient>
  );
}
```

The View puts the part that needs the data under a `QueryBoundary` with a skeleton, and reads it there:

```tsx
'use client';
export function DrawsView() {
  return (
    <section>
      <h1>{t('title')}</h1> {/* renders at once: needs no data */}
      <QueryBoundary fallback={<DrawsBoardSkeleton />}>
        <DrawsBoard />
      </QueryBoundary>
    </section>
  );
}

function DrawsBoard() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.draws.list.queryOptions());
  // `data` is always defined here: no `isLoading`, no `data ?? []`.
}
```

Several queries at once: `useSuspenseQueries({ queries: [trpc.a.queryOptions(), trpc.b.queryOptions()] })`.

**Which server proxy:**

- `publicTrpc`: `publicProcedure`s on a public page. It doesn't read the request, so the page stays static. Add `export const revalidate = <seconds>`.
- `trpc`: `protectedProcedure` / `consultantProcedure`, only on pages that already render per visit (a `requireSession` / `requireConsultant` layout or page). It reads the request's cookies.
- **Neither:** a visitor's private data on a static page (« Mes dépenses » on `/outils/budget`, the saved CRS simulations). Prefetching would make the page dynamic for everyone. Read it in the browser with `useQuery(trpc.x.queryOptions(input, { enabled: signedIn }))` and render the skeleton while `isPending`.

## 2. Skeletons, never « Chargement… »

- No loading sentences (« Chargement… », « Loading… ») and no bare spinners for content. While content loads, show a `Skeleton` laid out like it: same rows, same heights, same card shapes, so nothing jumps when it arrives.
- Build the skeleton next to the component it stands for (`draws-board.tsx` exports `DrawsBoardSkeleton`), from `Skeleton` blocks with canonical sizes (`h-4 w-32`, `h-24 rounded-2xl`). On navy sections use `bg-white/10`.
- Give the skeleton `aria-hidden` on its blocks and one `role="status"` with a screen-reader label (`<span className="sr-only">`) so the wait is still announced.
- A button that is sending keeps its label and is `disabled` (optionally a `Spinner` inside the button). That is an action in progress, not loading content.

## 3. Mutations: `useMutation`, invalidate, toast

```tsx
const trpc = useTRPC();
const queryClient = useQueryClient();
const t = useTranslations('Parcours');

const add = useMutation(
  trpc.parcours.add.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.parcours.list.queryKey() });
      toast.add({ title: t('toast.added'), type: 'success' });
    },
    onError: () => toast.add({ title: t('toast.addFailed'), type: 'error' }),
  }),
);
```

- **Invalidate** what the mutation changed with `trpc.<path>.queryKey()` (a whole router: `trpc.blog.dashboard.pathKey()`).
- **Toast** the outcome: `success` when something was saved, deleted or sent; `error` when it failed; `info` / `warning` for other notices. Titles are translated (`messages/{fr,en}.json`) and short: « Étape ajoutée », « L’étape n’a pas pu être ajoutée. Réessayez. ». Fall back to `Common.Toast.genericError`.
- **Inline errors stay inline** when they belong to a field (a slug already taken, a missing title): the message sits under the field, and no toast is added. Toasts are for the outcome of an action, not for form validation.
- Don't toast reads: a query that fails shows the `QueryBoundary` « Réessayer » panel.

## 4. Tests

Use `createTestTRPC` from `src/trpc/__tests__/test-utils.tsx` instead of mocking `@/trpc/client`:

```tsx
const { trpc, queryClient, wrap } = createTestTRPC({
  'parcours.add': (input) => ({ id: 'e2', ...input }),
  'parcours.list': () => etapes, // the refetch after invalidation
});
queryClient.setQueryData(trpc.parcours.list.queryKey(), etapes); // what the page prefetched
render(withIntl(wrap(<ParcoursView />)));

await user.click(screen.getByRole('button', { name: 'Ajouter' }));
expect(await screen.findByText('Étape ajoutée')).toBeInTheDocument(); // the toast
```

Seeding the cache plays the server prefetch, so the View renders its data on the first render. To test the skeleton, leave the cache empty and give a handler that never resolves (`() => new Promise(() => {})`).
