import { deleteFiles } from '@/features/dossiers/server/dossier-files';
import { HISTORY_DAYS } from '@/features/pdf-tools/lib/history-schema';
import type { TRPCContext } from '@/server/trpc/context';

/** Deletes the history files older than 90 days, and their encrypted copies (daily job). Resolves to how many. */
export async function purgeOldPdfToolFiles(db: TRPCContext['prisma'], now: Date): Promise<number> {
  const before = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const old = await db.pdfToolFile.findMany({
    where: { createdAt: { lt: before } },
    select: { id: true, objectKey: true },
  });
  if (old.length === 0) return 0;
  await db.pdfToolFile.deleteMany({ where: { id: { in: old.map((file) => file.id) } } });
  await deleteFiles(old.map((file) => file.objectKey));
  return old.length;
}
