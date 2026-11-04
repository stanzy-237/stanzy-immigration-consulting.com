import { after } from 'next/server';

import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { meetingEmail, type MeetingEmailKind } from '@/features/meetings/lib/meeting-emails';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';

type Client = { email: string; name: string; locale: string };
type MeetingFacts = {
  id: string;
  dossierId: string;
  subject: string;
  startsAt: Date;
  durationMinutes: number;
  recording: boolean;
};

/** The Client's link: the room, or the Dossier's Réunions once cancelled. */
export function clientMeetingUrl(siteUrl: string, client: Client, meeting: MeetingFacts, kind: MeetingEmailKind): string {
  const base = `${siteUrl}/${toLocale(client.locale)}`;
  return kind === 'cancelled'
    ? `${base}/mon-espace/dossiers/${meeting.dossierId}#reunions`
    : `${base}${clientRoomPath(meeting.dossierId, meeting.id)}`;
}

/** Emails the Client about a Réunion; a failure is logged, never thrown. */
export async function emailClient(
  deps: { mailer: Mailer; siteUrl: string },
  client: Client,
  meeting: MeetingFacts,
  kind: MeetingEmailKind,
  reason?: string | null,
): Promise<void> {
  try {
    await deps.mailer.send(
      meetingEmail({
        to: client.email,
        name: client.name,
        locale: client.locale,
        kind,
        meeting,
        reason,
        url: clientMeetingUrl(deps.siteUrl, client, meeting, kind),
      }),
    );
  } catch (error) {
    console.error('[meetings] could not email the Client', meeting.id, kind, error);
  }
}

/** The same, after the response, so the consultant's click doesn't wait. */
export function emailClientLater(
  deps: { mailer: Mailer; siteUrl: string },
  client: Client,
  meeting: MeetingFacts,
  kind: MeetingEmailKind,
  reason?: string | null,
): void {
  after(() => emailClient(deps, client, meeting, kind, reason));
}

/** What a Réunion Notification's text and link need. */
export const meetingParams = (meeting: MeetingFacts, extra: Record<string, string> = {}): Record<string, string> => ({
  meetingId: meeting.id,
  subject: meeting.subject,
  startsAt: meeting.startsAt.toISOString(),
  ...extra,
});
