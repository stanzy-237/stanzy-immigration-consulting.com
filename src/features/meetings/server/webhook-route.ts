import { meetingIdOf } from '@/features/meetings/lib/meeting-schema';
import { recordMeetingFile, type StreamFile } from '@/features/meetings/server/meeting-files';
import { stream, streamConfigured } from '@/features/meetings/server/stream';
import { prisma } from '@/server/db/client';

type FileEvent = {
  type: string;
  call_cid?: string;
  call_recording?: StreamFile;
  call_transcription?: StreamFile;
};

/**
 * POST /api/meetings/webhook, called by Stream (#94), signed with the API
 * secret. Records a Réunion's Enregistrement and Transcription once ready
 * (see meeting-files: the Réunions pages also fetch them when this doesn't
 * come). Any other event is acknowledged and ignored. Each call is logged.
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
  if (!valid) {
    console.warn('[meetings] webhook refused: bad signature');
    return new Response(null, { status: 401 });
  }

  const event = JSON.parse(body) as FileEvent;
  console.info(`[meetings] webhook ${event.type} for ${event.call_cid ?? '—'}`);
  const file =
    event.type === 'call.recording_ready'
      ? event.call_recording
      : event.type === 'call.transcription_ready'
        ? event.call_transcription
        : undefined;
  const meetingId = event.call_cid ? meetingIdOf(event.call_cid) : null;
  if (!file || !meetingId) return new Response(null, { status: 204 });

  await recordMeetingFile(prisma, meetingId, event.type === 'call.recording_ready' ? 'RECORDING' : 'TRANSCRIPTION', file);
  return new Response(null, { status: 204 });
}
