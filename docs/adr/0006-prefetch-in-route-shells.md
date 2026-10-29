# Routes prefetch their View's tRPC queries

`docs/agents/folder-structure.md` keeps routes thin, with no data fetching above `<FeatureView />`. Until now every View asked for its data from the browser after the page had loaded. A visitor saw the page, then « Chargement… », then the content: one more round trip after the HTML, which on a slow connection is seconds.

We decided that a route's `page.tsx` may start its View's tRPC queries with `prefetch(trpc.<router>.<procedure>.queryOptions(input))` and wrap the View in `<HydrateClient>`, as `code-with-antonio/resonance` does. The prefetch doesn't wait: the page streams, and the View's `useSuspenseQuery` picks the result up from the hydrated cache. The route still holds no logic. It names the queries its View reads, with the same inputs, and nothing else.

Two server proxies keep static pages static. `publicTrpc` has no session and doesn't read the request, so a public page that prefetches through it stays cacheable; it sets `export const revalidate`. `trpc` carries the visitor's session and reads the request, so it is used only on pages that already render per visit (behind `requireSession` or `requireConsultant`). A visitor's private data on a static page (« Mes dépenses » on the public budget page) is not prefetched: the View fetches it in the browser and shows a skeleton meanwhile.

We considered fetching in a server component inside the feature and passing the data down as props. We rejected it: the client cache then starts empty, so mutations can't invalidate what the server rendered, and every View would need a server twin. The how-to is in `docs/agents/data-fetching.md`.
