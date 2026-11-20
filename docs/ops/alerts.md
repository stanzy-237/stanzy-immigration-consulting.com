# Alerts (#164)

Vercel Observability monitors on the production project, defined in `docs/ops/monitors.json` and added with `scripts/apply-monitors.sh` (idempotent by name). Alerts are included in Pro. Custom monitors cost $0.0035 per GB of logs scanned, a fraction of a cent at our traffic.

## Thresholds

Chosen from the 7 days before 2026-11-20 (production): **0 server errors**, tRPC p95 **1.4 s** on average (worst 4 h bucket 2.3 s), pages about 2 s, PDF routes too rare to rank.

| Monitor | Window | Fires when | Severity |
|---|---|---|---|
| 5xx spike | 5 min | more than 5 responses with status ≥ 500 | high |
| Function error rate | 15 min | more than 5 % of function invocations fail, with at least 3 failures | high |
| Slow tRPC (p95) | 15 min | p95 of `/api/trpc/[trpc]` above 4 s | medium |
| Slow PDF routes (p95) | 15 min | p95 above 6 s on the Contrat, Facture, Reconnaissance, Version and service-file routes | medium |

Vercel's built-in **Default Alert Rule** (anomaly detection on every project, high severity and up) stays on beside them.

## Who is told

Each monitor notifies the team owners (`enableTeamOwnerNotifications`) by Vercel's notifications. Email delivery follows each owner's preferences: **Vercel → Account Settings → Notifications → Alerts**, with Email on.

Rollbar (#160) emails new errors separately, with the Account (id and role) and a masked replay. Client reports land in the Tableau de bord's « Signalements ».

## When one fires

1. Vercel → the project → Observability: the failing route, status codes, and logs for the window.
2. Rollbar: the same errors, grouped, with stack traces.
3. A slow PDF route: open it in the browser, then DevTools → Network → Timing → **Server-Timing** splits session, database, access check, R2 and decryption (#165).
