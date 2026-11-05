import { after } from 'next/server';

import { meetingEmail, type MeetingEmailKind } from '@/features/meetings/lib/meeting-emails';
import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';

/** Someone invited: a Client or a partner, with their account. */
export type Person = { id: string; email: string; name: string; locale: string };
export type MeetingFacts = {
  id: string;
  dossierId: string | null;
  subject: string;
  startsAt: Date;
  durationMinutes: number;
  recording: boolean;
};

/** Their link: the room, or once cancelled the Dossier's Réunions (or the room's page, saying so). */
export function participantUrl(siteUrl: string, person: Person, meeting: MeetingFacts, kind: MeetingEmailKind): string {
  const base = `${siteUrl}/${toLocale(person.locale)}`;
  return kind === 'cancelled' && meeting.dossierId
    ? `${base}/mon-espace/dossiers/${meeting.dossierId}?onglet=reunions`
    : `${base}${clientRoomPath(meeting.id)}`;
}

/** Emails one participant about a Réunion; a failure is logged, never thrown. */
export async function emailParticipant(
  deps: { mailer: Mailer; siteUrl: string },
  person: Person,
  meeting: MeetingFacts,
  kind: MeetingEmailKind,
  reason?: string | null,
): Promise<void> {
  try {
    await deps.mailer.send(
      meetingEmail({
        to: person.email,
        name: person.name,
        locale: person.locale,
        kind,
        meeting,
        reason,
        url: participantUrl(deps.siteUrl, person, meeting, kind),
      }),
    );
  } catch (error) {
    console.error('[meetings] could not email a participant', meeting.id, kind, error);
  }
}

/** The same for each of them, after the response, so the consultant's click doesn't wait. */
export function emailParticipantsLater(
  deps: { mailer: Mailer; siteUrl: string },
  people: Person[],
  meeting: MeetingFacts,
  kind: MeetingEmailKind,
  reason?: string | null,
): void {
  if (people.length === 0) return;
  after(async () => {
    for (const person of people) await emailParticipant(deps, person, meeting, kind, reason);
  });
}

/** What a Réunion Notification's text and link need. */
export const meetingParams = (meeting: MeetingFacts, extra: Record<string, string> = {}): Record<string, string> => ({
  meetingId: meeting.id,
  subject: meeting.subject,
  startsAt: meeting.startsAt.toISOString(),
  ...extra,
});
