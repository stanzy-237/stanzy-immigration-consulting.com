import { callIdOf, transcriptText } from '@/features/meetings/lib/meeting-schema';
import { stream, streamConfigured } from '@/features/meetings/server/stream';
import type { TRPCContext } from '@/server/trpc/context';
import { objectSize } from '@/server/storage/r2';

type Db = TRPCContext['prisma'];

/** Where Stream's external storage puts the files in the private bucket (scripts/setup-stream.mjs). */
export const MEETING_STORAGE_PATH = 'meetings/';

/** Stream keeps a call's files two weeks; past that only our own copy in R2 is left. */
const SYNC_DAYS = 14;

export type StreamFile = { filename: string; url: string; start_time: string | Date; end_time: string | Date };
export type FileKind = 'RECORDING' | 'TRANSCRIPTION';

/** Our bucket's key for a file Stream stored there, when it is found. */
export async function storedKey(meetingId: string, filename: string): Promise<string | null> {
  // Stream files them under the call: meetings/default_meeting_<id>/<filename>.
  for (const key of [`${MEETING_STORAGE_PATH}default_${callIdOf(meetingId)}/${filename}`, `${MEETING_STORAGE_PATH}${filename}`]) {
    try {
      if ((await objectSize('private', key)) !== null) return key;
    } catch {
      // Try the next place.
    }
  }
  return null;
}

/**
 * Records one of a Réunion's files (#94): where it is, and for a
 * Transcription its words, with each speaker's name, for searching. Saving
 * the same file twice only updates it.
 */
export async function recordMeetingFile(db: Db, meetingId: string, kind: FileKind, file: StreamFile): Promise<void> {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, participants: { select: { account: { select: { id: true, name: true } } } } },
  });
  if (!meeting) return;

  let text: string | null = null;
  if (kind === 'TRANSCRIPTION') {
    const consultants = await db.account.findMany({ where: { role: 'CONSULTANT' }, select: { id: true, name: true } });
    const names = Object.fromEntries(
      [...meeting.participants.map(({ account }) => account), ...consultants].map((person) => [person.id, person.name]),
    );
    try {
      const response = await fetch(file.url);
      if (response.ok) text = transcriptText(await response.text(), names);
    } catch (error) {
      console.error('[meetings] could not read a Transcription', meeting.id, error);
    }
  }

  const data = {
    url: file.url,
    objectKey: await storedKey(meeting.id, file.filename),
    startedAt: new Date(file.start_time),
    endedAt: new Date(file.end_time),
    text,
  };
  await db.meetingRecording.upsert({
    where: { meetingId_kind_filename: { meetingId: meeting.id, kind, filename: file.filename } },
    create: { meetingId: meeting.id, kind, filename: file.filename, ...data },
    update: data,
  });
}

/**
 * Asks Stream for the files of the recorded Réunions of the last two weeks
 * that still lack theirs, and records them: the way in when Stream's webhook
 * doesn't come. Called when the consultant opens the Réunions; a failure is
 * logged and the page shows what is already saved.
 */
export async function syncMeetingFiles(db: Db, now = new Date()): Promise<void> {
  if (!streamConfigured()) return;
  const since = new Date(now.getTime() - SYNC_DAYS * 86_400_000);
  const meetings = await db.meeting.findMany({
    where: {
      recording: true,
      startsAt: { gte: since, lte: now },
      OR: [{ endedAt: { not: null } }, { kind: 'PERSONAL' }],
    },
    select: { id: true, recordings: { select: { kind: true, filename: true } } },
  });
  // Ended ones with both kinds already in need nothing more.
  const pending = meetings.filter(
    (meeting) => !(meeting.recordings.some((r) => r.kind === 'RECORDING') && meeting.recordings.some((r) => r.kind === 'TRANSCRIPTION')),
  );
  await Promise.all(
    pending.map(async (meeting) => {
      try {
        const call = stream().video.call('default', callIdOf(meeting.id));
        const [{ recordings }, { transcriptions }] = await Promise.all([call.listRecordings(), call.listTranscriptions()]);
        const known = new Set(meeting.recordings.map((r) => `${r.kind}:${r.filename}`));
        const files = [
          ...recordings.map((file) => ({ kind: 'RECORDING' as const, file })),
          ...transcriptions.map((file) => ({ kind: 'TRANSCRIPTION' as const, file })),
        ].filter(({ kind, file }) => !known.has(`${kind}:${file.filename}`));
        for (const { kind, file } of files) await recordMeetingFile(db, meeting.id, kind, file);
        if (files.length > 0) console.info(`[meetings] synced ${files.length} file(s) from Stream for ${meeting.id}`);
      } catch (error) {
        console.error('[meetings] could not sync files from Stream', meeting.id, error);
      }
    }),
  );
}
