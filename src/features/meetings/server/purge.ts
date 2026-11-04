import type { TRPCContext } from '@/server/trpc/context';
import { deleteObjects } from '@/server/storage/r2';

type Db = TRPCContext['prisma'];

/** Enregistrements and Transcriptions are kept until this long after their Dossier is closed (#94). */
export const MEETING_FILES_KEPT_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Deletes the Réunion files of Dossiers closed more than 2 years ago, from the bucket and the database. */
export async function purgeOldMeetingFiles(db: Db, now: Date): Promise<number> {
  const old = await db.meetingRecording.findMany({
    where: { meeting: { dossier: { state: 'CLOSED', closedAt: { lt: new Date(now.getTime() - MEETING_FILES_KEPT_MS) } } } },
    select: { id: true, objectKey: true },
  });
  if (old.length === 0) return 0;
  const keys = old.flatMap((row) => (row.objectKey ? [row.objectKey] : []));
  if (keys.length > 0) await deleteObjects('private', keys);
  const { count } = await db.meetingRecording.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  return count;
}
