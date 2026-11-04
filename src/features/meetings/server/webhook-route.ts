import { meetingIdOf, transcriptText } from '@/features/meetings/lib/meeting-schema';
import { stream, streamConfigured } from '@/features/meetings/server/stream';
import { prisma } from '@/server/db/client';
import { objectSize } from '@/server/storage/r2';

/** Where Stream's external storage puts the files in the private bucket (scripts/setup-stream.mjs). */
export const MEETING_STORAGE_PATH = 'meetings/';

type FileEvent = {
  type: string;
  call_cid?: string;
  call_recording?: StreamFile;
  call_transcription?: StreamFile;
};
type StreamFile = { filename: string; url: string; start_time: string; end_time: string };

/** Our bucket's key for a file Stream stored there, when it is found. */
async function storedKey(filename: string): Promise<string | null> {
  const key = `${MEETING_STORAGE_PATH}${filename}`;
  try {
    return (await objectSize('private', key)) === null ? null : key;
  } catch {
    return null;
  }
}

/**
 * POST /api/meetings/webhook, called by Stream (#94), signed with the API
 * secret. Records a Réunion's Enregistrement and Transcription once ready:
 * where the file is, and a Transcription's words for searching. Any other
 * event is acknowledged and ignored.
 */
export async function POST(request: Request): Promise<Response> {
  if (!streamConfigured()) return new Response(null, { status: 503 });
  const body = await request.text();
  const signature = request.headers.get('x-signature') ?? '';
  let valid = false;
  try {
    valid = stream().verifyWebhook(body, signature);
  } catch {
    valid = false;
  }
  if (!valid) return new Response(null, { status: 401 });

  const event = JSON.parse(body) as FileEvent;
  const file =
    event.type === 'call.recording_ready'
      ? event.call_recording
      : event.type === 'call.transcription_ready'
        ? event.call_transcription
        : undefined;
  const meetingId = event.call_cid ? meetingIdOf(event.call_cid) : null;
  if (!file || !meetingId) return new Response(null, { status: 204 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, dossier: { select: { account: { select: { id: true, name: true } } } } },
  });
  if (!meeting) return new Response(null, { status: 204 });

  const kind = event.type === 'call.recording_ready' ? 'RECORDING' : 'TRANSCRIPTION';
  let text: string | null = null;
  if (kind === 'TRANSCRIPTION') {
    const consultants = await prisma.account.findMany({ where: { role: 'CONSULTANT' }, select: { id: true, name: true } });
    const names = Object.fromEntries(
      [meeting.dossier.account, ...consultants].map((person) => [person.id, person.name]),
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
    objectKey: await storedKey(file.filename),
    startedAt: new Date(file.start_time),
    endedAt: new Date(file.end_time),
    text,
  };
  await prisma.meetingRecording.upsert({
    where: { meetingId_kind_filename: { meetingId: meeting.id, kind, filename: file.filename } },
    create: { meetingId: meeting.id, kind, filename: file.filename, ...data },
    update: data,
  });
  return new Response(null, { status: 204 });
}
