import type { TRPCContext } from '@/server/trpc/context';
import { deleteObjects } from '@/server/storage/r2';

type Db = TRPCContext['prisma'];

/** Enregistrements and Transcriptions are kept this long after their Dossier closes, or after the recording outside one (#94). */
export const MEETING_FILES_KEPT_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/**
 * Deletes Réunion files from the bucket and the database: those of Dossiers
 * closed more than 2 years ago, and those recorded outside any Dossier 2 years ago.
 */
export async function purgeOldMeetingFiles(db: Db, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - MEETING_FILES_KEPT_MS);
  const old = await db.meetingRecording.findMany({
    where: {
      OR: [
        { meeting: { dossier: { state: 'CLOSED', closedAt: { lt: cutoff } } } },
        // A Réunion outside any Dossier: 2 years after it was recorded.
        { meeting: { dossierId: null }, startedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, objectKey: true },
  });
  if (old.length === 0) return 0;
  const keys = old.flatMap((row) => (row.objectKey ? [row.objectKey] : []));
  if (keys.length > 0) await deleteObjects('private', keys);
  const { count } = await db.meetingRecording.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  return count;
}
