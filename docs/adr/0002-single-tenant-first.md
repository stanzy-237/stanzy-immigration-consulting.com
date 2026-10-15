# Single-tenant for v1; defer multi-agency SaaS

The long-term vision includes an all-in-one product that **other agencies purchase** — a multi-tenant SaaS. We decided v1 is **single-tenant**: it serves only Stanzy's own practice, with no tenant isolation, per-agency branding, or agency-scoped data.

We deliberately do **not** build multi-tenancy now, accepting that retrofitting it later (tenant scoping across every table, auth, and the admin surface) will be real work. The trade-off: multi-tenancy upfront would slow v1 significantly for a market we haven't validated, and building it speculatively risks the wrong abstractions. We revisit this when a concrete agency customer exists.
