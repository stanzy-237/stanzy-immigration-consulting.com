# Folder structure

This project organises code **by feature**, following the layout of [`code-with-antonio/resonance`](https://github.com/code-with-antonio/resonance). Every agent working in this repo MUST read this doc before creating a new file, moving a file, or proposing a new module in a spec. Deviations need an ADR under `docs/adr/`.

## Top-level layout under `src/`

```
src/
├─ app/                 # Next.js App Router — thin routing shell only
│  ├─ [locale]/         # locale-scoped routes (fr default, en, es scaffolded)
│  │  ├─ layout.tsx
│  │  ├─ page.tsx       # imports a <View /> from src/features/<x>/views
│  │  └─ <segment>/     # one folder per route segment; same rule — thin
│  ├─ api/              # route handlers only; business logic lives in features
│  ├─ globals.css
│  └─ manifest.ts
├─ features/            # ALL product code lives here, grouped by feature
│  └─ <feature>/        # see "Feature folder" below
├─ components/
│  ├─ ui/               # shadcn/ui primitives — generic, feature-agnostic
│  └─ <x>.tsx           # cross-cutting non-shadcn components (e.g. ServiceWorkerRegister)
├─ hooks/               # cross-feature hooks only; feature hooks go in the feature
├─ lib/                 # cross-cutting utilities (cn, formatting, analytics)
├─ server/              # server-only helpers shared by features (db, auth)
├─ trpc/                # tRPC router wiring (routers themselves live in features)
├─ i18n/                # next-intl routing config
├─ messages/            # next-intl translation JSON per locale
└─ proxy.ts
```

**Content production is not in this repo.** The video engine and the content workspace live in `../stanzy_content_studio` ([ADR 0004](../adr/0004-content-studio-separate-repo.md)).

## Feature folder

Each product capability (landing page, CRS calculator, 67-points calculator, timeline, draws, blog, services, auth, …) is one feature folder:

```
src/features/<feature>/
├─ views/              # top-level composed pages — one per route the feature owns
│  └─ <feature>-view.tsx
├─ components/         # React components private to this feature
│  └─ <component>.tsx
├─ data/               # typed content/config modules (nav items, FAQ, draws, …)
│  └─ <topic>.ts
├─ hooks/              # feature-local hooks (optional)
├─ contexts/           # feature-local React contexts (optional)
├─ server/             # feature server code: tRPC routers, server actions (optional)
└─ lib/                # feature-local pure utilities (optional)
```

### Rules

1. **Routes are thin.** A `src/app/.../page.tsx` file contains metadata, locale setup, and a single `<FeatureView />` import. No business logic, no section composition, no data fetching above `<FeatureView />`.
2. **One feature folder per product capability.** When in doubt, map it to a GitHub issue / spec: one spec usually = one feature folder.
3. **No cross-feature imports between `components/`.** Feature A does not import `src/features/B/components/*`. If two features need the same component, promote it to `src/components/ui/` (if generic) or to a new `src/features/shared/` feature (if domain-specific).
4. **`src/components/ui/` is for generic primitives only** — the shadcn/ui output and brand-token wrappers. Nothing that mentions a domain term (CRS, tirage, dossier, …) belongs there.
5. **Data lives next to the feature that owns it.** A static `data/draws.ts` for the home page lives in `src/features/landing/data/`; the live draws tool, when built, owns its own `src/features/draws/data/`.
6. **Tests live beside the code they test** in `__tests__/` subfolders — under the feature (`src/features/<f>/components/__tests__/*.test.tsx`, `src/features/<f>/views/__tests__/*.test.tsx`) and the same way under any other `src/` subtree (`src/components/ui/__tests__/`, `src/server/trpc/routers/__tests__/`, `src/i18n/__tests__/`). Vitest/Playwright config (`tests/setup.ts`, type augmentations) is the only thing that may stay in a top-level `tests/`.
7. **Imports use `@/` paths.** `@/features/landing/views/home-view`, not relative traversal.
8. **Naming is kebab-case files, PascalCase exports.** `faq-section.tsx` exporting `FaqSection`.

## When writing a spec (`/to-spec`)

Specify the seam in the **Implementation Decisions** section using this layout. One feature folder per spec is the default. If a spec touches two features, it needs an explicit note on why and which files cross the boundary.

## When implementing (`/implement`, `/implement-spec`, `/tdd`)

Before creating a file, check:
- Is this a route? → thin `src/app/.../page.tsx` that imports a view.
- Is this a composed page? → `src/features/<f>/views/<f>-view.tsx`.
- Is this a reusable primitive with no domain term in it? → `src/components/ui/`.
- Is this anything else? → under the owning feature's subfolder (`components/`, `data/`, `hooks/`, `server/`, `lib/`).

If none of these fit, surface the question before writing the file — do not invent a new top-level folder.

## Reference

Inspiration: https://github.com/code-with-antonio/resonance (`src/features/<feature>/{views,components,data,hooks,contexts}`). We mirror its shape, with `server/` and `lib/` added where features need them.
