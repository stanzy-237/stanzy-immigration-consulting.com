# Stanzy Immigration Consulting

French-first, installable PWA for Stanzy's Canadian immigration consulting practice.
See [`GLOSSARY.md`](./GLOSSARY.md) for domain vocabulary and [`docs/adr/`](./docs/adr)
for the hard-to-reverse decisions. The v1 spec is epic **#1**.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **tRPC** (+ TanStack Query) for the typed API
- **Prisma** ORM → **Neon** Postgres
- **Tailwind CSS**
- **next-intl** — `fr` (default) + `en`, every route locale-prefixed (`/fr`, `/en`)
- **PWA** — web manifest + runtime-caching service worker (installable, app shell cached)
- Deployed on **Vercel**

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Neon connection strings
npm run db:generate    # generate the Prisma client
./scripts/setup-auth.sh  # auth secret, Resend, Vercel env, migration (guided)
./scripts/setup-google-sign-in.sh  # Google OAuth client (optional)
npm run dev            # http://localhost:3000 → redirects to /fr
```

`/` redirects to the default locale. `/fr` and `/en` both resolve.

## Scripts

| Script                | What it does                                   |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Next dev server                                |
| `npm run build`       | Production build                               |
| `npm run start`       | Serve the production build                     |
| `npm run lint`        | ESLint (`eslint-config-next`)                  |
| `npm run typecheck`   | `tsc --noEmit`                                 |
| `npm test`            | Vitest (run once)                              |
| `npm run test:watch`  | Vitest watch mode                              |
| `npm run db:generate` | `prisma generate`                              |
| `npm run db:migrate`  | `prisma migrate dev`                           |
| `npm run db:deploy`   | `prisma migrate deploy` (CI/production)        |

## Project layout

```
src/
  app/
    [locale]/            # locale-scoped routes (layout, home, locale switcher)
    api/auth/[...all]/   # Better Auth HTTP handler
    api/trpc/[trpc]/     # tRPC HTTP handler
    manifest.ts          # PWA web manifest (/manifest.webmanifest)
    service-worker-register.tsx
    globals.css          # Tailwind + brand tokens
  i18n/                  # next-intl routing / request / navigation config
  messages/              # fr.json, en.json message catalogs
  features/auth/         # Inscription / Connexion / Vérification, auth client
  server/
    auth/                # Better Auth instance (createAuth) + session lookup
    db/client.ts         # Prisma client singleton
    email/mailer.ts      # Resend transactional mailer
    trpc/                # tRPC init, context, routers
  trpc/react.tsx         # client-side tRPC + React Query provider
  lib/env.ts             # validated environment variables
prisma/schema.prisma     # Prisma ↔ Neon (Account, Session, AuthIdentity, …)
public/sw.js             # service worker
tests/                   # Vitest
```

## Deploying to Vercel against Neon

This is a one-time human setup (requires account credentials):

1. Create a **Neon** project at <https://neon.tech> and copy the pooled and
   direct connection strings.
2. Import the GitHub repo into **Vercel**. Framework preset: **Next.js**.
3. Add Vercel environment variables:
   - `DATABASE_URL` — Neon **pooled** connection string
   - `DIRECT_URL` — Neon **direct** connection string
   - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM` —
     `./scripts/setup-auth.sh` walks through these
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional; enables Google sign-in) —
     `./scripts/setup-google-sign-in.sh` walks through these
4. Deploy. `prisma generate` runs on `postinstall`; the app boots and `/fr` /
   `/en` resolve. Apply migrations with `npm run db:deploy`.
```
