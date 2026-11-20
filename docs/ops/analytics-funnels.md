# Analytics funnels (#161)

Vercel Web Analytics custom events, read in the project's **Analytics → Events** panel. Every event carries the step and, at most, the service or the method. Never a name, an email, an amount or free text (`src/lib/analytics.ts`).

Server events (`trackLater`, `src/server/analytics.ts`) are sent from the server after the response, so an ad blocker can't hide them, and only on Vercel. Browser events (`track`) are skipped in development.

## The funnels

| Funnel | Step | Event | Props | Where |
|---|---|---|---|---|
| Sign-up / sign-in | Account created | `auth.signed_up` | `method`: email, google | server (Better Auth hook) |
| | Signed in | `auth.signed_in` | `method` | server |
| Demande d'intérêt | Form seen | `interest.viewed` | | browser |
| | Started (past step 1) | `interest.started` | | browser |
| | Sent | `interest.submitted` | `level`, `residence`, `crs` (a 50-point range) | server |
| | Approved / rejected | `interest.approved` (`level`), `interest.rejected` | | server |
| Service documentaire (private Offre link) | Offre page seen | `service.offer.viewed` | `service` (slug) | browser |
| | Conditions and contract ticked | `service.conditions.accepted` | `service` | browser |
| | Ordered | `service.ordered` | `service` | server |
| | Order approved | `service.order.approved` | | server |
| Service documentaire (Mon espace) | Service page seen | `service.viewed` | `service`, `fromDocument` | browser |
| Contrat | Sent / signed | `contract.sent`, `contract.signed` | `kind` (main, amendment, service), `service` | server |
| Facture | Sent | `invoice.sent` | `service` | server |
| | Opened by the Client (PDF) | `invoice.opened` | `service` | server |
| | Preuve de paiement uploaded by the Client | `invoice.proof_uploaded` | `service` | server |
| | Paid | `invoice.paid` | `service` | server |

`service` on Contrat and Facture events is the Dossier's service type (`ACCOMPAGNEMENT`, `SERVICE_DOCUMENTAIRE`, …).

Other events (tools, CTAs, PDF tool, subscriptions) predate #161: `grep -rn "track(\|trackLater(" src`.

## Reading a funnel

Compare the counts of consecutive steps over the same period. For example, `service.offer.viewed` → `service.conditions.accepted` → `service.ordered` shows where visitors of a private link stop.
