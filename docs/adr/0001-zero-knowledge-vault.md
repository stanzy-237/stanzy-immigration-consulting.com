# Zero-knowledge encryption for the Coffre-fort (Vault)

The Vault stores highly sensitive user data (immigration documents, IRCC account security questions/answers, and — in a later phase — passwords). We decided the Vault is **zero-knowledge**: contents are encrypted client-side with a key derived from the user's own passphrase, so neither the server nor Stanzy can ever read them.

The deliberate consequence is **non-recoverability**: if a user forgets their Vault passphrase, their data is permanently lost and cannot be reset by an admin. We accept this because the alternative — server-side decryptable storage — would make the platform a custodian of plaintext immigration secrets, an unacceptable liability. Opening the Vault additionally requires TOTP two-factor (see [auth decisions]).

For v1 the Vault is scoped to encrypted **documents and secure notes** only; the dedicated password-manager/autofill feature is explicitly deferred.

**Boundary:** documents a user uploads so the consultant can *act* on them (e.g. diplomas submitted for an ECA) are **not** Vault items — the consultant must be able to read those. They live in a separate, consultant-readable "service documents" store (encrypted at rest, decryptable server-side). Only the user's own private items go in the zero-knowledge Vault.
