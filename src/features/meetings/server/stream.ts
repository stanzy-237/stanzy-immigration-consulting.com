import { StreamClient } from '@stream-io/node-sdk';

import { callIdOf } from '@/features/meetings/lib/meeting-schema';
import { env } from '@/lib/env';

/** How long a room's token lasts: a long Réunion, plus margin. */
const TOKEN_SECONDS = 4 * 60 * 60;

let client: StreamClient | null = null;

/** Whether Réunions can be joined on this deploy (STREAM_API_KEY and STREAM_API_SECRET set). */
export const streamConfigured = (): boolean => Boolean(env.STREAM_API_KEY && env.STREAM_API_SECRET);

/** The Stream server client; MEETINGS_UNCONFIGURED without the keys. */
export function stream(): StreamClient {
  if (!env.STREAM_API_KEY || !env.STREAM_API_SECRET) throw new Error('MEETINGS_UNCONFIGURED');
  client ??= new StreamClient(env.STREAM_API_KEY, env.STREAM_API_SECRET);
  return client;
}

type Person = { id: string; name: string; consultant: boolean };

/**
 * Gets a Réunion's call ready and lets `viewer` in: the Dossier's Client and
 * the consultants as its members, recorded and transcribed (in the Client's
 * language) unless switched off, screens shareable. The token is valid for
 * this call only, so it opens no other Réunion.
 */
export async function openRoom(opts: {
  meeting: { id: string; recording: boolean; plannedById: string };
  people: Person[];
  viewer: Person;
  language: 'fr' | 'en';
}): Promise<{ apiKey: string; token: string; callId: string }> {
  const streamClient = stream();
  await streamClient.upsertUsers(opts.people.map((person) => ({ id: person.id, name: person.name })));
  const callId = callIdOf(opts.meeting.id);
  const call = streamClient.video.call('default', callId);
  const settings = {
    recording: { mode: opts.meeting.recording ? ('auto-on' as const) : ('disabled' as const), quality: '720p' as const },
    transcription: {
      mode: opts.meeting.recording ? ('auto-on' as const) : ('disabled' as const),
      language: opts.language,
    },
    screensharing: { enabled: true, access_request_enabled: false },
  };
  await call.getOrCreate({
    data: {
      created_by_id: opts.meeting.plannedById,
      members: opts.people.map((person) => ({ user_id: person.id, role: person.consultant ? 'host' : 'call_member' })),
      settings_override: settings,
    },
  });
  // The recording switch may have changed since the call was made.
  await call.update({ settings_override: settings });
  return {
    apiKey: env.STREAM_API_KEY!,
    token: streamClient.generateCallToken({
      user_id: opts.viewer.id,
      call_cids: [`default:${callId}`],
      validity_in_seconds: TOKEN_SECONDS,
    }),
    callId,
  };
}
