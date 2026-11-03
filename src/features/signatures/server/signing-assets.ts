import type { AssetKind } from '@/features/signatures/lib/signature-schema';
import { SIGNING_ASSET_PREFIX } from '@/features/signatures/lib/signature-schema';
import type { ImageFile } from '@/features/signatures/lib/sign-pdf';
import { encryptFile } from '@/features/dossiers/lib/file-crypto';
import { ENCRYPTED_CONTENT_TYPE, openEncryptedFile, sealKey } from '@/features/dossiers/server/dossier-files';
import type { TRPCContext } from '@/server/trpc/context';
import { deleteObjects, writeObject } from '@/server/storage/r2';

type Db = TRPCContext['prisma'];

/**
 * The consultant's signature and the company stamp (#96): uploaded once,
 * encrypted on the server like the Dossiers' files (ADR 0007), replaced by
 * a new upload.
 */
export async function storeSigningAsset(
  db: Db,
  kind: AssetKind,
  file: { bytes: ArrayBuffer; type: ImageFile['type'] },
): Promise<void> {
  const { ciphertext, key, iv } = await encryptFile(file.bytes);
  const objectKey = `${SIGNING_ASSET_PREFIX}${kind.toLowerCase()}-${crypto.randomUUID()}.bin`;
  await writeObject('private', objectKey, ciphertext, { contentType: ENCRYPTED_CONTENT_TYPE });
  const wrappedKey = await sealKey(key);
  const previous = await db.signingAsset.findUnique({ where: { kind }, select: { objectKey: true } });
  const data = { contentType: file.type, objectKey, wrappedKey, iv };
  await db.signingAsset.upsert({ where: { kind }, create: { kind, ...data }, update: data });
  if (previous) await deleteObjects('private', [previous.objectKey]);
}

/** When each was last uploaded; null for one still missing. */
export async function signingAssetStatus(db: Db): Promise<Record<AssetKind, Date | null>> {
  const rows = await db.signingAsset.findMany({ select: { kind: true, updatedAt: true } });
  const at = (kind: AssetKind) => rows.find((row) => row.kind === kind)?.updatedAt ?? null;
  return { SIGNATURE: at('SIGNATURE'), STAMP: at('STAMP') };
}

/** One of them decrypted, or null while it is missing. */
export async function openSigningAsset(db: Db, kind: AssetKind): Promise<ImageFile | null> {
  const row = await db.signingAsset.findUnique({ where: { kind } });
  if (!row) return null;
  const bytes = await openEncryptedFile({ ...row, fileName: kind });
  return { bytes: new Uint8Array(bytes), type: row.contentType === 'image/png' ? 'image/png' : 'image/jpeg' };
}

/** Both, for a STAMP field; null unless both were uploaded. */
export async function openSigningAssets(db: Db): Promise<{ signature: ImageFile; stamp: ImageFile } | null> {
  const [signature, stamp] = await Promise.all([openSigningAsset(db, 'SIGNATURE'), openSigningAsset(db, 'STAMP')]);
  return signature && stamp ? { signature, stamp } : null;
}
