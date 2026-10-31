# Documents de service are encrypted in the browser with a key the server keeps

A Dossier's Documents (diplômes, relevés bancaires, passeports) are the most sensitive files the platform holds. #79 asks that they be encrypted at rest yet readable by the consultant, so they can't use the Coffre-fort's zero-knowledge design (ADR 0001), where only the member holds the key. They also outgrow a server upload: a Vercel Function accepts about 4.5 MB per request, and a phone scan is often larger.

We decided on envelope encryption. For each file, the browser draws a fresh AES-256-GCM key, encrypts the file with Web Crypto, and sends the ciphertext straight to Vercel Blob with a one-time token from `/api/dossiers/upload`. That route signs only paths under `dossiers/<dossierId>/`, and only for that Dossier's Client or the consultant while it is open. The browser then calls `dossiers.documents.addVersion` with the file's key. The server checks that the blob is in the Dossier's folder and exactly 16 bytes larger than the size announced (the GCM tag), then stores the key encrypted with `DOSSIER_FILES_KEY` (the "wrapped key"). It never stores the plain key. `/api/dossiers/files/<versionId>` checks access again, unwraps the key, decrypts the file and serves it with `Cache-Control: private, no-store`. No tRPC procedure returns a file's address or key.

The blobs use the existing public Blob store. What sits there is ciphertext at an address nobody can guess, and it is useless without the database row and the master key. A private store would add a second token for no extra protection, given that reads already go through our own route.

The browser chooses the file's key, so a Client could upload something that isn't encrypted properly. That only harms their own file. The server can't check what's inside, only that it's there and the right size.

`DOSSIER_FILES_KEY` must never change once files exist: rotating it means re-wrapping every key, which needs a script that doesn't exist yet. Losing it loses every Document de service.

We considered encrypting on the server. We rejected it: every upload would have to fit in one Function request. We also considered leaving files unencrypted in a private store. We rejected it because a leaked Blob token alone would then expose every passport.
