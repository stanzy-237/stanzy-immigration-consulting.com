# Auth guards may run in route shells

`docs/agents/folder-structure.md` keeps routes thin: no business logic and no data fetching above `<FeatureView />`. Protected pages need an authoritative, server-side session check that can redirect before anything renders. The proxy can only check that a cookie exists. The views are client components, so they can't do the check themselves.

We decided that a route's `layout.tsx` or `page.tsx` may make **one** guard call from `@/features/auth/server/guards` (`requireSession`) before it renders its View. The guard owns the session lookup, the `?next=` sanitising and the redirect, so the route still holds no logic of its own. A protected area puts `requireSession` in its segment layout, so every page below it is covered.

We considered wrapping each View in a server component inside the feature. We rejected that: it doubles the number of views for no behaviour gain, and it hides from the route the one fact a reader needs, that the page is gated. Anything beyond a single guard call still belongs in the feature.

**Update (2026-10):** the guest-only pages — Connexion, Inscription and their dialogs — no longer use a server guard. Checking the session on the server made them dynamic: every open waited for a serverless function (measured 4.4 s cold on production) and Link couldn't prefetch them. They are now static; the view reads `?next=` in the browser and sends someone who arrives already signed in on to it. This costs no security, since those pages hold nothing private; protected pages keep `requireSession`.
