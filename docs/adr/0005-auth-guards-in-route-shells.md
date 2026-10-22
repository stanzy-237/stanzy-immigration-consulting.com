# Auth guards may run in route shells

`docs/agents/folder-structure.md` keeps routes thin: no business logic and no data fetching above `<FeatureView />`. Protected pages need an authoritative, server-side session check that can redirect before anything renders. The proxy can only check that a cookie exists. The views are client components, so they can't do the check themselves.

We decided that a route's `layout.tsx` or `page.tsx` may make **one** guard call from `@/features/auth/server/guards` (`requireSession`, `redirectIfSignedIn`) before it renders its View. The guard owns the session lookup, the `?next=` sanitising and the redirect, so the route still holds no logic of its own. A protected area puts `requireSession` in its segment layout, so every page below it is covered.

We considered wrapping each View in a server component inside the feature. We rejected that: it doubles the number of views for no behaviour gain, and it hides from the route the one fact a reader needs, that the page is gated. Anything beyond a single guard call still belongs in the feature.
