import { StreamClient } from '@stream-io/node-sdk';

import { callIdOf } from '@/features/meetings/lib/meeting-schema';
import { env } from '@/lib/env';
import { siteUrl } from '@/lib/site-url';

/**
 * How an Enregistrement looks, in the brand's colours: the speaker large
 * with the others on the right, each camera shown whole (« fit »: a phone's
 * portrait image is never cropped) on navy, the one speaking outlined in
 * rouge, names on a soft pill, the Réunion's subject top left and the logo
 * top right. Hex, not tokens: Stream's recorder reads plain CSS values.
 */
export function recordingLayout(subject: string) {
  return {
    name: 'spotlight' as const,
    options: {
      'layout.background_color': '#0d1f4e',
      'layout.spotlight.participants_bar_position': 'right',
      'video.scale_mode': 'fit',
      'video.screenshare_scale_mode': 'fit',
      'video.background_color': '#1a3065',
      'participant.border_radius': '18px',
      'participant.outline_color': '#cc1627',
      'participant.outline_width': '3px',
      'participant.placeholder_background_color': '#1a3065',
      'participant_label.display': true,
      'participant_label.text_color': '#ffffff',
      'participant_label.background_color': 'rgba(13, 31, 78, 0.75)',
      'participant_label.border_radius': '999px',
      'participant_label.margin_inline': '12px',
      'participant_label.margin_block': '12px',
      'title.text': subject,
      'title.font_size': '22px',
      'title.color': '#ffffff',
      'title.margin_inline': '24px',
      'title.margin_block': '18px',
      'logo.image_url': `${siteUrl()}/Logo-white-background.svg`,
      'logo.height': '56px',
      'logo.horizontal_position': 'right',
      'logo.vertical_position': 'top',
      'logo.margin_inline': '24px',
      'logo.margin_block': '14px',
    },
  };
}

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

/** « Terminer pour tous »: Stream closes the call for everyone in it and stops its recording. */
export async function endRoom(meetingId: string): Promise<void> {
  await stream().video.call('default', callIdOf(meetingId)).end();
}

/**
 * Gets a Réunion's call ready and lets `viewer` in: the Dossier's Client and
 * the consultants as its members, recorded and transcribed (in the Client's
 * language) unless switched off, screens shareable. The token is valid for
 * this call only, so it opens no other Réunion.
 */
export async function openRoom(opts: {
  meeting: { id: string; subject: string; recording: boolean; plannedById: string };
  people: Person[];
  viewer: Person;
  language: 'fr' | 'en';
}): Promise<{ apiKey: string; token: string; callId: string }> {
  const streamClient = stream();
  await streamClient.upsertUsers(opts.people.map((person) => ({ id: person.id, name: person.name })));
  const callId = callIdOf(opts.meeting.id);
  const call = streamClient.video.call('default', callId);
  const settings = {
    recording: {
      mode: opts.meeting.recording ? ('auto-on' as const) : ('disabled' as const),
      quality: '720p' as const,
      layout: recordingLayout(opts.meeting.subject),
    },
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
  // The recording switch may have changed since the call was made, and people let in since.
  await call.update({ settings_override: settings });
  await call.updateCallMembers({
    update_members: opts.people.map((person) => ({ user_id: person.id, role: person.consultant ? 'host' : 'call_member' })),
  });
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
