# Consultation — design reference

The paid **Consultation** end to end: public page, booking, payment, the Client's Mon espace, the consultant's Tableau de bord, e-mails and WhatsApp. Designed in Paper; this file holds the rules the screens imply, so building matches them. The screens are the source of truth for layout and copy; this file is the source of truth for behaviour.

- **Paper file:** « Stanzy Immgration consulting » (`01M7Z4GSEZCG4NR26V5HX4M13S`).
- **Pages:** « Stanzy · Produit » (screens, design system) and « Marketing Stanzy » (e-mails).
- **Build it:** issue #15 (Consultation booking) — its Cal.com plan is replaced by this design.

Before building any part, open its artboards (names below) with the Paper MCP and copy exact values with `get_jsx` / `get_computed_styles`. Copy goes into `fr.json` / `en.json`, never hard-coded.

## Never in the repo

- **No prices.** The Consultation price lives in the dashboard, Consultations → Disponibilités → « Tarif » (`consultation_settings.price`); without one, payment stays closed. Code, tests and docs say « le prix de la Consultation », mocks use `XX XXX FCFA`.
- **No promo codes or percentages.** Codes are created in the dashboard (Codes promo). Tests use made-up codes.
- **Test payments with a `sk_test_` key only.** Load the `saspay-integration` skill before any payment code.

## Words

Use `GLOSSARY.md`. Terms this design relies on: Consultation, Réunion, Enregistrement, Transcription, Lead, Client, Compte, Facture, Demande d'intérêt, Dossier, Code promo.

Recordings stay the consultant's, with one exception: a **Consultation's** Enregistrement and Transcription, once published, are shown to its Client to watch and read only. Never a download, and never for other Réunions (Dossier meetings stay consultant-only).

## Screens

| Part | Artboards (Paper, page « Stanzy · Produit ») |
|---|---|
| Public page | `Consultation · Page v2 · Desktop`, `· Mobile`, its motion on `Consultation · Page v2 · Motion` (v1 `Consultation · Page` is superseded) |
| Booking | `Réservation v2 · 1 Vos coordonnées`, `2 Préparer l'échange`, `3 Paiement`, `3b Hors Mobile Money (carte)`, `3c Code de paiement (Orange CI)`, `4 Créneau libéré` (Desktop) · Mobile: `1 Qui êtes-vous`, `2 Pour bien préparer`, `3 Vérifier et payer`, `3a Feuille code promo` (+ `Places épuisées`, `Offre terminée`, `Déjà utilisé`), `3b Feuille paiement (carte)`, `3c Feuille code Orange CI`, `3d Dernière place partie`, `4 Créneau libéré` |
| Payment | `Paiement v2 · 1 Validez sur le téléphone`, `2 Page SasPay`, `3 Vérification`, `4 Refusé`, `5 Toujours en attente`, `6 Confirmée` (Desktop + Mobile) |
| Client space | `Mon espace v2 · 1 Avant`, `2 Salle d'attente`, `3 Après · Récap`, `4 Déplacer le créneau`, `5 Mes consultations`, `6 Aucune consultation` (Desktop + Mobile) |
| Dashboard | `Tableau de bord · Aperçu`, `· Consultations` (+ `Variante — Paiements échoués`), `· Consultation · 1 Avant`, `· Consultation · 2 Après`, `· Codes promo` (+ `Feuille Nouveau code`), Desktop + Mobile |
| E-mails | page « Marketing Stanzy », board `E-mails · 3.2 Consultation payée`; Réunion e-mails on `3.3 Réunions` |
| WhatsApp | « Marketing Stanzy », board `E-mails · 3.9 Partenaires et WhatsApp` |
| Parts | design-system boards `Réservation & Paiement`, `Mon espace & messages`, `Tableau de bord`, `Illustrations & Stanzy` |

Mobile is its own design (bottom sheets, bottom action bar, one step per screen), never the desktop shrunk.

## Lifecycle

```text
créneau choisi ──► GARDÉ (15 min) ──► paiement SasPay
                       │                 ├─ SUCCESS ─► PAYÉE ─► Réunion créée ─► rappels ─► TERMINÉE ─► PUBLIÉE
                       │                 ├─ FAILED  ─► « Paiement non abouti » (retry while still GARDÉ)
                       │                 └─ PENDING ─► « Toujours en attente » (verify again; never deliver)
                       └─ 15 min passed, not paid ─► LIBÉRÉ (« Créneau libéré »)
PAYÉE ─► DÉPLACÉE (new slot, same Réunion; by the Client, or automatically when the consultant cancels)
```

- **Slot hold.** Choosing a slot holds it for that person for 15 minutes (`Réservation v2` timer « créneau gardé jusqu'à HH:MM »). Held slots disappear for everyone else. After 15 minutes unpaid it is released and the booker sees `4 Créneau libéré`.
- **Paid means SasPay `SUCCESS` only**, read from `GET /payments/{id}/verify/` or a verified webhook. A redirect, a timer or `PENDING` never confirms a Consultation. Deliver once (unique constraint in the database).
- **On `SUCCESS`, in one transaction:** mark the Consultation paid, create its Réunion (`MeetingKind` scheduled, recorded, the Client invited), count the promo place if a code was used, number its **Facture payée**, queue the confirmation e-mail with the Facture attached. The account becomes a **Lead** if it was a plain User.
- **Fees:** the client pays SasPay fees on top (`fee_charge_mode: ADD_ON`). Screens show « + frais selon le moyen de paiement ».
- **Payment methods** come from SasPay per country (`GET /pricing/my-rates/`); never hard-code a list. Push networks show `1 Validez sur le téléphone`; networks with a `checkout_url` (Orange, Wave, card) open `2 Page SasPay`; Orange CI asks for its code first (`3c`); countries without Mobile Money get card (`3b`).
- **Time zone:** every time is shown « heure de Douala » (`Africa/Douala`), like the meeting e-mails (`fr.json` « {when} (heure de Douala) »).

## Booking

- **Step 1 — Vos coordonnées:** name, country, e-mail, phone. Signed-in accounts see it filled and folded (« Modifier »). For someone signed out, this step **creates their Compte** (or finds the one with that e-mail and asks them to sign in) before the slot is held. So every held slot, payment attempt and promo use belongs to a Compte: « Une seule fois par Compte » can be enforced, Mon espace works right after payment, and failed payments link to a Compte. The e-mail is confirmed with the existing Vérification e-mail.
- **Step 2 — Préparer l'échange:** everything optional. Topics (multi-select: « Mon admissibilité », « Gagner des points CRS », « Mes documents », « La suite »), CRS score (link to the CRS calculator), « Avez-vous déjà été sélectionné ? » (Non / Oui, ITA reçue), situation (max 500 characters, counter). The consultant sees these answers on `Consultation · 1 Avant` as « Ce qu'[prénom] a préparé ».
- **Step 3 — Paiement:** summary card (date, duration, what is included), promo field, total, pay button.

## Promo codes

Managed in Tableau de bord → Facturation → **Codes promo** (new sidebar item). A code has: text, reduction (% or FCFA), services it applies to, number of places, optional end date and time (Douala), « Une seule fois par Compte ».

- **Applied at checkout only**; pages always show the full price.
- **A place is counted when the payment succeeds**, never when the code is applied.
- **Places are re-checked just before the SasPay payment is sent.** If none is left the booker sees « La dernière place vient de partir » with the full price, before paying (`3d Dernière place partie`). The cap is never exceeded.
- **Errors**, each its own message (mobile: inside the promo sheet): code inconnu or expiré, places épuisées (`Places épuisées`), offre terminée (`Offre terminée`), déjà utilisé par ce Compte (`Déjà utilisé`).
- **Deleting a code** stops it at once; payments already made keep their reduction.
- The dashboard list shows places used / total with a bar, status (Actif, Épuisé, Terminé) and the end date with « dans N jours ».

## Client space (Mon espace)

- **1 Avant:** date, countdown, what to prepare, « Tester ma caméra », « Déplacer », the Facture payée.
- **2 Salle d'attente:** « Rejoindre » opens **15 minutes before** the start (same rule as `meeting-schema.ts`). Recording consent is asked before joining.
- **3 Après · Récap:** only after the consultant publishes: video (streamed, **no download**), Notes de Stanzy with timestamps (a timestamp seeks the video), Transcription, « Vos prochaines étapes » checklist (the Client ticks them), documents cited, the Facture payée (downloadable PDF), and the Accompagnement call to action (« Envoyer ma demande » → Demande d'intérêt). The video stays visible as long as the Enregistrement is kept (2 years, glossary).
- **4 Déplacer le créneau:** pick another free slot; the Réunion moves (meeting e-mail « Déplacée »). How long before the start moving closes is a Disponibilités setting.
- **No refund.** A paid Consultation is never refunded; the way out is « Déplacer ». Say so on the Facture and before paying.
- **When the consultant cancels**, the Consultation is not lost: it moves at once to the **next free slot**, the Client is told (e-mail « Déplacée » with the consultant's reason, bell, WhatsApp when built) and can still change it with « Déplacer ».
- **5 Mes consultations / 6 Aucune consultation:** list and empty state with its own illustration.

## Consultant dashboard

### Sidebar

Two new entries in `src/features/dashboard/data/sections.ts`, built with their routes:

| key | label (`Dashboard.nav`) | group | icon (lucide) | placed after |
|---|---|---|---|---|
| `consultations` | Consultations | `clients` | `CalendarCheck` | `reunions` |
| `codes-promo` | Codes promo | `billing` | `TicketPercent` | `services` |

### Aperçu

The overview becomes a daily view (`Tableau de bord · Aperçu`): four figures (À traiter, Réunions aujourd'hui, Dossiers ouverts, Encaissé ce mois), « À traiter » rows (Demandes d'intérêt, Commandes de services, Factures en retard, Signatures en attente, Signalements; overdue in blush/rouge, waiting-on-Client counts grey), « Aujourd'hui » (meetings, next one with « Rejoindre »), active promo code, Dossiers récents, Blog. Empty « À traiter » shows « Tout est traité » with its illustration. Needs one summary query; every count already exists in a router.

### Consultations list

Tabs « À venir », « Passées », « Paiements échoués » (count = unresolved failures). Right column: Disponibilités (weekly hours, duration, pause between, how early one can book, how far ahead, « Bloquer une date »). Rows link to the Consultation page.

**Three views** (switch top right, the last choice remembered on the device; boards `Consultations · C · Liste`, `Variante C — Barre`, `C · Modifier en panneau`, `C · Modifier en onglet`). No right column any more: each view has the full width.

- **Liste:** tabs « À venir », « Passées », « Paiements échoués », then the table (Quand, Client, Paiement, Préparé = the topics chosen, Action). No Disponibilités here.
- **Calendrier:** the Disponibilités in one bar (open days grouped, « lun – ven 09–17 », the rules, the price, « Modifier ») above the week. « Modifier » opens the side panel, to change something on the go: hours, rules one per line, price, blocked dates, « Annuler / Enregistrer ». Desktop shows one week (Monday to Sunday, from the earliest to the latest open hour, « ‹ Aujourd'hui › »); mobile one day, with a strip of the week's days. It shows paid Consultations (leaf), held ones (honey, dashed, « Gardé N min »), the consultant's other Réunions (white, grey border, since they block slots too), the open hours (ice-blue) and blocked dates (hatched, crossed out on mobile); past ones faded, a rouge « now » line on today. Read-only: a block opens its Consultation or Réunion; no drag to move (« Déplacer » asks for a reason and tells the Client). No month view.
- **Disponibilités** (`Consultations · 3 Disponibilités`, `3b Feuille jour`): full control, several slots a day. Desktop: a timeline per day (8h → 22h, widened to the slots). Hovering a gap shows a dashed hour and « + Ajouter 14h »; a click adds it, shortened before the next slot. Dragging a slot's edge resizes it in 30-minute steps, between its neighbours. Clicking a slot opens De / À with « Supprimer » and « OK ». Slots that touch merge. A « + » per day adds the first free hour from 9h (keyboard). Phones: one line per day, « 9h–13h · 18h–22h » or « Fermé », opening the day's sheet: Disponible, De / À per slot, « Ajouter une plage », « Copier vers » other days, Annuler / Enregistrer (saves at once). Right column (stacked on phones): the rules, the price and blocked dates, « Enregistrer ».

The mobile « Mes disponibilités » bottom bar is gone: the three views replace it.

**Rows:** the Client's name on one line, cut with « … » (full name on hover), body-sm; status pills small (label size, tight tracking) and never wrap.

**Paiements échoués:** attempt time, who, the slot they wanted, network and outcome (Refusé / Non validé), and « Payée ensuite » when a retry succeeded. Note under the table: the Client got « Votre paiement n'est pas passé », nothing was charged, the slot stays held 15 minutes then is released.

### Consultation page

One route, two states:

- **1 Avant (v2):** a header card: initials, the name on one line (cut with « … »), « Payée · réseau », the date; « Rejoindre » (greyed until 15 min before), « Déplacer », « ⋯ » (Renvoyer la confirmation: the paid e-mail again with its Facture; Voir le Compte; Annuler ce créneau). Right column: « Déroulé » first (Réservée et payée, the reminder the day before, planned or sent, or « pas envoyé » when booked under 24 h ahead, 15 min before, then the Consultation), then Paiement, Son Compte. The details below still hold.

- **1 Avant:** header (name, « Payée · réseau », date, « Déplacer », « Rejoindre » greyed with « S'ouvre à HH:MM » until 15 min before), « Ce qu'[prénom] a préparé » (booking answers, the situation as a quote), **Vos notes** (private, autosaved, stored as the Réunion's `notes`), Paiement (price, promo line, paid amount + frais, network, time, Facture), Son Compte (Lead badge, contact, « Ouvrir un dossier »), reminders sent (day before; 15 min before), « Annuler ce créneau » (asks for a reason, shows the next free slot the Client will be moved to, then moves and notifies; no refund, no lost Consultation).
- **2 Après** (built for the consultant; shown once its time has passed or « Terminer pour tous » ended it; data: `consultation_note` with `atSeconds`, `consultation_step`, `consultation.publishedAt`; the Client's side is part of Mon espace, point 4.2): header « Terminée · N min », the recording with markers, tabs « Notes pour [prénom] » (timestamped notes written for the Client) / Transcription / « Vos notes privées », « Ses prochaines étapes » (checklist written for the Client), « Dans son espace » (what she will see), « Ouvrir un dossier ».
- **Publier dans son espace:** nothing reaches the Client before it. Publishing makes the video, transcription, notes for the Client and next steps visible in her Mon espace and sends « Votre enregistrement est prêt ». Private notes are never shown. The consultant can edit after publishing.

Mobile: same content; « Rejoindre » or « Publier » in the bottom bar; « Déplacer » and « Annuler » in the « ⋯ » menu.

## Notifications

| When | E-mail (board) | Status |
|---|---|---|
| Paid | Confirmation + Facture payée attached (`3.2`) | built (`lib/consultation-emails.ts`, `server/consultation-invoice.ts`) |
| Payment failed | Paiement non abouti (`3.2`) | built (`lib/consultation-emails.ts`) |
| Published | Enregistrement prêt (`3.2`); with steps, they are listed and it uses the « next steps » art | built (`lib/consultation-emails.ts` `consultationPublishedEmail`), sent the first time only |
| Day before / 15 min before / moved | Réunion e-mails (`3.3`) | exist (`meetings/lib/meeting-emails.ts`) |
| Consultant cancels → auto-moved | « Déplacée » with the reason and a « Choisir un autre créneau » button | extend `moved` |

WhatsApp twins of the Consultation messages are designed (`3.9`) and not built. E-mails are sent from the notifications subdomain via Resend (`src/server/email/mailer.ts`).

## States to cover

Loading → skeletons shaped like the content (ADR 0006); mutations end in a toast. Empty states use their own brand illustrations from `Design system · Illustrations & Stanzy` (never a generic icon). Every screen above has its mobile artboard.

## Motion

Every animation on these screens, and the rules behind them, is in `docs/design/consultation-motion.md`. Read it before writing any motion. Anything not in its table does not animate.

## Decisions

- **Recording:** shared only for Consultations, once published; watch only, no download; visible while the Enregistrement is kept. (2026-11-23)
- **Moving:** allowed, up to a Disponibilités setting before the start. **Refunds:** never. (2026-11-23)
- **Consultant cancels:** the Client is moved to the next free slot, notified, and can change it. (2026-11-23)
- **Accounts:** booking step 1 creates or finds the Compte before the slot is held, so failed payments always link to a Compte. (2026-11-23)
- **Paying keeps the slot a little longer:** « Payer » extends the hold to 10 minutes from then, never past 45 minutes after the slot was first held, so someone validating on their phone doesn't lose it. If SasPay still says `SUCCESS` after the slot went to someone else, the Consultation is delivered on the next free slot and the confirmation e-mail says so: a paid Consultation is never lost. (2026-11-24)
- **Card is SasPay's `card` network** (listed by my-rates in a country of its own, `XX`), paid on SasPay's card page and charged in USD at the day's rate: the receipt shows SasPay's own amounts in that currency. Every softpay carries a `return_url` to `/reserver/paiement/<id>` (not in the OpenAPI spec, required by SasPay for `card`, accepted on every network). « Payer depuis un autre pays » lists every country; one with no Mobile Money offers card (`3b`). (2026-11-24)
- **Codes promo, built:** a percentage (1–99) or an FCFA amount, never leaving less than 100 FCFA to pay (SasPay can't take a free Consultation). Just before paying, the places of payments still on their way (PENDING, at most 45 min old) count too, so the cap is never exceeded; a code refused then comes off the booking and the page shows the full price before anything is sent. Deleting is soft: the code stops at once, held bookings lose it, paid reductions stay on their payments. An unknown code suggests the live code at most 2 letters away. (2026-11-24)
- **A Facture payée, not a Reconnaissance:** a paid Consultation gets a Facture, stamped « Payée » and signed like the Dossiers' (numbered with them, `STZ-<year>-<0001>`), downloadable from « C'est réservé » and attached to the confirmation. The Paper screens still say « Reconnaissance »: the Facture replaces it. (2026-11-24)
- **Consultations in the Tableau de bord, built (point 4.1):** the tabs, the Disponibilités with several ranges a day typed as « 09:00 – 12:00 · 14:00 – 16:00 » (empty: unavailable) and the price, and « 1 Avant ». « Déplacer » and « Annuler ce créneau » move the Consultation and its Réunion together, under the booking lock, and reset the reminders. A Consultation's Réunion moved from the Réunions page instead would not move the Consultation: move Consultations from their own page. (2026-11-26)
- **Sandbox outside production:** the app calls `sandbox-api.saspay.me` everywhere but Vercel production, and refuses an `sk_live_` key there (`server/saspay.ts`). (2026-11-24)
