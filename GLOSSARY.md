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

**Type de tirage** (Draw type):
What a Tirage targeted, as IRCC names it ("Provincial Nominee Program", "French-Language proficiency 2026-Version 2", …). Grouped for filtering into Général, PNP, CEC, Français and Catégorie (every category-based round: STEM, santé, métiers, transport, …).

**Alerte tirage** (Draw alert):
A push notification sent to every subscribed device each time a new Tirage is published, whatever the owner's CRS score: it tells people a round happened, not whether they were invited. A device is subscribed as soon as it allows Stanzy's notifications (the browser's own "Allow" can't be skipped), unless its visitor turned alerts off.
_Avoid_: "ITA alert" (an ITA is the invitation a candidate receives, not the round).

**Prédiction de tirage** (Draw prediction):
The Prochain tirage tool's estimate of a group's next Tirage, from the Tirages Stanzy stored: a date window (from the usual gaps between the group's Tirages in the last 12 months), a CRS score range with its median (the group's last 5 cut-offs) and a one-sentence explanation. Always shown as an estimate, never as an announcement: IRCC publishes no schedule.
_Avoid_: "forecast", "announcement", "next draw date" (it is a window, not a date).

**CNP** (Classification nationale des professions / NOC):
Canada's occupation classification. Each job maps to a CNP code, which determines Entrée Express eligibility. Subject of the code-search tool.
_Avoid_: NOC in product-facing French copy; use CNP.

**67 points** (FSW eligibility grid):
The 100-point Federal Skilled Worker eligibility grid where 67 is the pass mark. Distinct from the CRS score — it is a pass/fail gate, not a ranking. Subject of its own calculator.
_Avoid_: conflating with CRS.

**NCLC / CLB** (Niveaux de compétence linguistique canadiens / Canadian Language Benchmarks):
Canada's language levels, 1 to 12: NCLC for French, CLB for English. Each approved test's results convert to a level per skill (speaking, listening, reading, writing); a program's minimum applies to every skill, so the weakest one decides. Subject of its own calculator.
_Avoid_: "score" for the level (the score is the test's own result, e.g. TCF 699).

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

**Réunion** (Meeting):
A video meeting held in the app between the consultant and the people invited, each with an account (Clients, partners): planned ahead, started at once (« Réunion instantanée »), or in the Salle personnelle. About a Dossier (its Client invited) or on its own. Someone with the invitation link but not invited asks to enter and waits until the consultant lets them in. Recorded unless the consultant turns it off, after everyone accepted it; « Terminer pour tous » ends it for everyone.
_Avoid_: "Consultation" (a paid appointment a prospect books on Cal.com).

**Salle personnelle** (Personal room):
The consultant's Réunion that is always open, with its own invitation link, which the consultant can change.

**Enregistrement** (Recording):
The video of a Réunion, for the consultant only: kept until 2 years after its Dossier is closed, or 2 years after the recording for a Réunion outside any Dossier.

**Transcription**:
The searchable text of a recorded Réunion, kept with its Enregistrement, for the consultant only.

**Messages du dossier** (Dossier messages):
The general conversation of a Dossier between its Client and the consultant, apart from each Document's conversation: messages with replies (one level), files attached.

**Client**:
A Lead with at least one open Dossier: their Demande d'intérêt for Accompagnement was approved, or the consultant sent the invoice for a Services documentaires order. A Client follows their Dossiers in « Mon espace ».
_Avoid_: "customer" in product-facing French; use Client.

**Consultant**:
Stanzy, the one person who runs the practice and administers the platform. Being the consultant is an access level an Account holds, separate from its User → Lead → Client status: the consultant is never "a Client". Nobody can make themselves consultant; it is set by configuration.
_Avoid_: "admin", "staff".

**Tableau de bord** (Dashboard):
The consultant's own area of the platform: a sidebar of sections (Aperçu, Blog for now; Leads, Clients and Contenus later) that only the consultant can open. Anyone else signed in gets a 404.
_Avoid_: "admin", "back-office".

**Article**:
A Blog post the consultant writes in the Tableau de bord, in French or English. It is a Brouillon (draft, visible only in the Tableau de bord) until published; once Publié it appears on the Blog, the home page and the sitemap. Its publish date is set the first time it is published.
_Avoid_: "post" in product-facing French copy.

**Catégorie d'article** (Article category):
One of the consultant's own headings for the Blog (Entrée Express, Documents, Langue, …), named in French and English. Every Article has exactly one; a category still in use can't be deleted.

**Tag**:
A free keyword on an Article (`tcf`, `preuve-de-fonds`), stored lowercase with hyphens. An Article has any number; the Blog can be filtered by one.

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
The case file for a Client's engagement — what the consultant tracks and works through. Made of Sections IRCC holding Documents, and moved through its service's Workflow de service. An Accompagnement Dossier opens at the stage matching the Client's Niveau.

**Section IRCC** (IRCC upload slot):
One upload box of the IRCC portal within a Dossier (« Diplômes – Requérant principal », « Preuve de fonds »…). It holds several Documents and produces exactly one Fichier de soumission.

**Document** (in a Dossier):
One piece inside a Section IRCC (a diplôme, a relevé de notes, a rapport WES…), generated from the Checklist logic or added by the Client or the consultant. Has Versions and one conversation (« Échanges »): messages between the Client and the consultant, each with its replies, one level deep. **Manquant** when the Client doesn't have it yet.
_Avoid_: "file" (a Document has several Versions).

**Version**:
One upload of a Document (V1, V2…), by the Client or the consultant, or delivered by a Partner's Mission. The consultant alone marks one Version **Finale**, and can change it until the Dossier passes « Vérification et dépôt ».
_Avoid_: "Mouture" (that is a Partner's draft inside a Mission).

**Fichier de soumission** (Submission file):
The single PDF of a Section IRCC that is uploaded to the IRCC portal, built with the Outils PDF from its Documents' Versions. Never above 4 Mo.

**Outils PDF** (PDF tools):
The consultant's iLovePDF-style tool in the Tableau de bord: merge, reorder, rotate and delete pages, turn photos into PDF, compress to 4 Mo. Runs in the browser, on a Section IRCC or on local files.

**Notification**:
One line in an Account's notification center (the bell in « Mon espace » or the Tableau de bord) telling them something happened that concerns them: a message, a Version, a stage, a Facture, a reminder, a new Tirage. It opens the exact item and is **non lue** until then. Several of the same kind, by the same person, on the same Document within 30 minutes are one Notification. Never for the Account's own action. Some also go out by email, and to the phone as a general push when the Account turned that on.
_Avoid_: "alert" (an Alerte tirage is one kind of Notification), "message" (a message is what someone writes in a Document's conversation).

**Parcours** (Journey / Timeline):
A User's own, self-logged journal of immigration milestones — each a dated **Étape** with a label, a short code, an optional note and a colour. The User adds, edits and deletes entries freely; it is not a fixed pipeline with mandatory stages. Has a clean, branded, **screenshot-ready** view ("Voir la timeline" / "Partager", headed "Mon Parcours Entrée Express") that users capture and share (e.g. on WhatsApp) — not a public server-hosted link. This is what the "timeline" tool is — NOT IRCC's published processing times.
_Avoid_: "timeline" (ambiguous with IRCC processing times), "stages" (implies a fixed sequence).

**Étape** (Milestone):
One dated entry in a Parcours. Comes from a preset catalogue (ITA, FRAIS/paiement IRCC, DÉPÔT, AOR, VM/MED, IBIO/BIO, SÉCU, ADR, PPR, COPR, ARRIVÉE) or a free-form "Autre étape". Presets currently run from ITA to arrival (the post-invitation application phase).

**Estimation de budget** (Budget estimate):
The answers a person gives the Budget & dépenses estimator (family, language tests, ECAs, currency and conversion rate) and the prices they edited, with the « Frais à payer » lines they produce. Kept in the browser, and in the Account once a User saves it. IRCC's settlement funds are shown beside it as « Fonds à prouver », never added to its total: that money is kept, not spent.
_Avoid_: "devis", "budget" alone (ambiguous with what was actually spent).

**Dépense** (Expense):
One amount a User logged as spent on their procedure: a name, a motif from a fixed list (Test de langue, Frais IRCC, Biométrie, …), an amount in the Account's single currency, a date and an optional note. Private to the Account; changing the currency never converts Dépenses already logged.
_Avoid_: "transaction", "paiement" (IRCC payments are one kind of Dépense).

**Checklist Entrée Express** (Express Entry checklist):
The documents a candidate should prepare before the ITA, built from a few answers about their situation (family, studies, each job, each country lived in, special situations) and prefilled from their latest saved Simulation or the CRS answers on the device. Laid out like IRCC's personal checklist: one block per person (Requérant principal, Conjoint(e), Enfant 1, 2…), each with IRCC's slots (« Relevé d'emploi – <poste> », « Certificat de police – <pays> »…) and the documents that go in them, ★ Obligatoire or Recommandé, each opening a guide and ticked « Prêt »; IRCC's fees close the list. Answers and ticks stay in the browser, and in the Account for a User. A preparation aid: IRCC's personalized checklist after the ITA is the reference. Stores no files (that is the Coffre-fort).
_Avoid_: "document list" alone (ambiguous with the Coffre-fort or Documents de service).

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
The ordered set of stages the consultant moves a Dossier through by hand for a given service type, visible to the Client as progress. Stages can move back, and a Dossier can be closed early as Clôturé with a reason. Each service type has its own stage set; Accompagnement has 10, from Évaluation du profil to COPR.

**Facture** (Invoice):
A bill the consultant writes in the Tableau de bord for a Dossier, in a currency of its own (XAF by default), sent by email as a PDF: Brouillon → Envoyée → Preuve reçue → Payée (or En retard, Annulée). A Dossier can have several.
Accompagnement, Vérification and Services documentaires have no Devis: the quoted amount goes straight on the Facture.

**Contrat** (Service contract):
The service agreement for a Dossier, made from its service's template (French or English), numbered CTR-<year>-<0001> when sent, carrying the consultant's signature and the company stamp, and signed online by the Client (the Account holding the Dossier) in « Mon espace ». Locked once signed.

**Modèle de contrat** (Contract template):
The text of a service's Contrat in one language, written by the consultant in the Tableau de bord, with blanks (`{client}`, `{service}`, `{prix}`, `{echeancier}`, `{date}`, `{numero}`) filled in when a Contrat is sent. The price and échéancier are entered at each sending, never in the template.

**Avenant** (Amendment):
A change to a signed Contrat, signed the same way and numbered after it (CTR-2026-0001-A1). A signed Contrat itself never changes.

**Demande de signature** (Signature request):
A PDF Version of a Document that the consultant sends to the Client to sign online (a lettre d'explication, a déclaration…), with the fields placed on it: Signature, Nom complet, Date, and optionally the consultant's signature with the company stamp. Only the Client holding the Dossier signs it, in « Mon espace », clicking each field to fill it (drawing the signature in black or blue ink). Once signed, the signed PDF becomes the Document's next Version, with nothing added but what was filled in: it is what goes to IRCC. Who signed, when, from where and the original's fingerprint are kept with the Demande. One waits per Document at a time; the consultant can cancel it to send a corrected one. Contrats use the same signing.
_Avoid_: "e-signature", "envelope".

**Certificat de signature** (Signature certificate):
The last page added to a signed Contrat (never to a document for IRCC): who signed (the name typed and the Account), when (Douala time), the IP address and device, and the SHA-256 fingerprint of the original PDF, which shows whether it was changed.

**Recette** (Income):
Money the practice received, in the consultant's Finances: a Facture marked Payée (added by itself) or an entry made by hand.
_Avoid_: "Dépense" (that is a Client's budget entry).

**Charge** (Business expense):
Money the practice spent, in the consultant's Finances: amount, currency, category, optional receipt, optionally linked to a Dossier, possibly repeating every month.
_Avoid_: "Dépense" (that is a Client's budget entry in their Estimation de budget).

**Demande d'intérêt** (Expression of interest):
The IRCC-style form a signed-in User fills to ask for Accompagnement: their profile, a « Je l'ai / Je ne l'ai pas / Pas sûr / Stanzy s'en charge » answer and a note per document area. Submitting it makes them a Lead; the consultant approves or rejects it.

**Niveau** (Level):
How far an Accompagnement candidate already is, worked out from their Demande d'intérêt and changeable by the consultant: **A Débutant**, **B Prérequis faits** (language test and EDE done, no Entrée Express profile), **C Profil créé** (in the pool, invited or not). It sets the Dossier's starting stage.

### Services (paid offerings)

Services have **no fixed public price** — each is quoted per case, with the amount set on the invoice. The Services documentaires have catalogue prices, but they are never public.



**Accompagnement Entrée Express**:
End-to-end guidance of a client through their Express Entry application, from their Niveau up to COPR. Starts with a Demande d'intérêt and includes Vérification et soumission des documents; an EDE is a separate service.

**Vérification et soumission des documents**:
Checking and preparing every file of a client's RP application after their ITA, which the client then submits from their own IRCC account with Stanzy's Guide de soumission. Stanzy is not the declared representative and never holds the client's IRCC login. Ends at the AOR.
_Avoid_: saying Stanzy submits "on their behalf".

**Guide de soumission** (Submission guide):
The list a Client follows to submit on the IRCC portal: each Section IRCC under the portal's own upload box name, with its Fichier de soumission to download and a « Téléversé » tick.

**Évaluation des diplômes étrangers** (ECA — Educational Credential Assessment):
Assessment of foreign credentials through recognized bodies such as WES or IQAS, to make them count for Entrée Express. Offered for diplomas issued in Cameroon; Stanzy handles every step up to the report, starting from a Demande de devis.

**Services documentaires** (Document services):
Documents Stanzy obtains for a Client in Cameroon at catalogue prices (preuve de fonds, certificat de police, attestation CNPS, compte salaire, ACF, pack expérience pro), usually through a Partner's Mission. Requested with « Stanzy s'en charge », which on any Document leads to the service's page in « Mon espace »: its conditions, contract and price, which the Client accepts. Each needs its own Contrat (apart from the Dossier's) and invoice line, sent when the consultant takes the request on. Never on a public page; shown to Clients in Cameroon in « Mon espace » and to anyone holding a Lien partagé. The only priced offering; its prices live only in the catalogue (Tableau de bord).

**ACF** (Attestation de conformité fiscale):
A Cameroonian tax compliance certificate, one of the Services documentaires.

**Lien partagé** (Shared link):
A password-protected, expiring link the consultant sends so that someone can read chosen Services documentaires and order them without being a Client, anonymously until they order. Revocable; an order placed through it stays valid after it expires.

**Dossier service documentaire**:
A small Dossier holding only the Documents someone ordered from the Services documentaires, without Accompagnement.

**Demande de devis** (Quote request):
The EDE's public form, filled without an Account: the evaluation body (WES by default, or IQAS), any existing WES/IQAS account, and up to two diplômes (a second only as a BTS / DSEP / HND / HPD next to a Licence), each showing the documents to provide. Nothing is uploaded in it.

**Devis** (Quote):
The EDE price calculated from a Demande de devis with the consultant's private fees (body, account setup, certification per document, service), emailed at once and valid 30 days. « Accepter le devis » makes the person a Client, opens the EDE Dossier and turns the Devis into its Facture.

**Formation TCF Canada**:
French-exam preparation. **Not built in this project** — it lives on a separate platform and is linked out to.
_Avoid_: treating this as an in-platform product.
