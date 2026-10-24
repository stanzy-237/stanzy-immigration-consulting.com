# Stanzy Immigration Consulting

The platform for Stanzy's Canadian immigration consulting practice: free Express Entry self-service tools, a blog, and paid consulting services, delivered as an installable progressive web app with a French-first audience.

## Language

### Express Entry domain

**Entrée Express** (Express Entry):
Canada's federal online system for managing skilled-worker immigration applications. The umbrella the free tools serve.

**CRS** (Comprehensive Ranking System / Système de classement global):
The points score that ranks candidates in the Entrée Express pool. Subject of the main calculator tool.

**Simulation**:
A set of answers to the CRS questions and the score they give, which a person can save to their Account and compare with others (e.g. "après TEF").
_Avoid_: "estimate", "profile" (IRCC's profile is the real one in the Entrée Express pool).

**ITA** (Invitation to Apply / Invitation à présenter une demande):
The invitation issued to a candidate after a draw, starting the clock to submit a full application.
_Avoid_: "invitation" unqualified.

**Tirage** (Draw / round of invitations):
A periodic selection from the Entrée Express pool, with a date and a CRS cut-off. The "latest draw" tool reports the most recent one.

**CNP** (Classification nationale des professions / NOC):
Canada's occupation classification. Each job maps to a CNP code, which determines Entrée Express eligibility. Subject of the code-search tool.
_Avoid_: NOC in product-facing French copy; use CNP.

**67 points** (FSW eligibility grid):
The 100-point Federal Skilled Worker eligibility grid where 67 is the pass mark. Distinct from the CRS score — it is a pass/fail gate, not a ranking. Subject of its own calculator.
_Avoid_: conflating with CRS.

### Platform concepts

**Account**:
A single person's login on the platform. One Account progresses through statuses rather than being re-created per role.

**User**:
An Account that has signed up and uses the free tools. The baseline status.
_Avoid_: "member".

**Lead** (Prospect):
A User whom the consultant is onboarding — typically after they booked a consultation or began a service process — but who is not yet a Client. Onboarding is driven by the consultant, not a self-serve enquiry form.

**Consultation**:
A paid, booked appointment between a User and the consultant, and the primary funnel into becoming a Client. Booked through an embedded external scheduler (Cal.com) in v1.

**Client**:
A Lead who has purchased Accompagnement. A Client has one or more Dossiers.
_Avoid_: "customer" in product-facing French; use Client.

**Consultant**:
Stanzy, the one person who runs the practice and administers the platform. Being the consultant is an access level an Account holds, separate from its User → Lead → Client status: the consultant is never "a Client". Nobody can make themselves consultant; it is set by configuration.
_Avoid_: "admin", "staff".

**Partner**:
An outside professional the consultant outsources part of a Client's work to. The consultant adds each Partner and gives them Missions; a Partner sees only their Missions, never a whole Client or the rest of the practice.
_Avoid_: "subcontractor", "freelancer", "agent".

**Mission**:
One document the consultant outsources to a Partner within a Client's Dossier (e.g. a certificat de police, a preuve de fonds, an attestation CNPS). It follows À faire → En cours → Mouture → Livré: the Mouture is the first draft, which the consultant and the Client review and can send back as Modif en cours until it is right. It carries a comment thread.

**Mouture** (Draft):
The reviewable draft of a Mission's document, without signature or cachet. Once the consultant approves it, the Partner delivers the final version, signed and stamped.
_Avoid_: "version", "brouillon".
_Avoid_: "task", "assignment", "job".

**Dossier**:
The case file for a Client's engagement — what the consultant tracks and works through.

**Parcours** (Journey / Timeline):
A User's own, self-logged journal of immigration milestones — each a dated **Étape** with a label, a short code, an optional note and a colour. The User adds, edits and deletes entries freely; it is not a fixed pipeline with mandatory stages. Has a clean, branded, **screenshot-ready** view ("Voir la timeline" / "Partager", headed "Mon Parcours Entrée Express") that users capture and share (e.g. on WhatsApp) — not a public server-hosted link. This is what the "timeline" tool is — NOT IRCC's published processing times.
_Avoid_: "timeline" (ambiguous with IRCC processing times), "stages" (implies a fixed sequence).

**Étape** (Milestone):
One dated entry in a Parcours. Comes from a preset catalogue (ITA, FRAIS/paiement IRCC, DÉPÔT, AOR, VM/MED, IBIO/BIO, SÉCU, ADR, PPR, COPR, ARRIVÉE) or a free-form "Autre étape". Presets currently run from ITA to arrival (the post-invitation application phase).

**Canal WhatsApp** (WhatsApp channel):
WhatsApp is a first-class contact/community channel surfaced on the site (e.g. "Rejoindre WhatsApp"), reflecting the francophone-Africa audience. Integration depth TBD.

**Coffre-fort** (Vault — working name "Clouds"):
A per-User, **zero-knowledge** secure store for the User's own private items: important documents, IRCC account security questions/answers, and (later) saved passwords. Encrypted client-side; the server and the consultant cannot read it. Login + TOTP required. Service-delivery documents do NOT belong here (see Documents de service).
_Avoid_: "clouds" (unclear), "storage".

**Documents de service** (Service documents):
Documents a User uploads for a specific paid service (e.g. diplomas for an ECA) via that service's fulfillment page. Consultant-readable (encrypted at rest but decryptable server-side) because the consultant must act on them. Distinct from the Coffre-fort.

**Preuve de paiement** (Payment proof):
A file a User uploads on a service's fulfillment page to evidence an offline payment, which the consultant reviews before marking the invoice paid. Stand-in until online payment exists.

**Workflow de service** (Service workflow):
The ordered set of stages the consultant advances for a given service type while delivering it, visible to the Client as progress. Each service type has its own stage set (concrete stages TBD from the design).

### Services (paid offerings)

Services have **no fixed public price** — each is quoted per case, with the amount set on the invoice.



**Accompagnement Entrée Express**:
End-to-end guidance of a client through their Express Entry application.

**Vérification et soumission des documents**:
Reviewing a client's documents and submitting them on their behalf.

**Évaluation des diplômes étrangers** (ECA — Educational Credential Assessment):
Assessment of foreign credentials through recognized bodies such as WES or IQAS, to make them count for Entrée Express.

**Formation TCF Canada**:
French-exam preparation. **Not built in this project** — it lives on a separate platform and is linked out to.
_Avoid_: treating this as an in-platform product.
