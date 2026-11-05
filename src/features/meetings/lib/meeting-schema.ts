import { z } from 'zod';

export const SUBJECT_MAX = 120;
export const DESCRIPTION_MAX = 1000;
/** Accounts one Réunion can invite besides the consultant. */
export const PARTICIPANTS_MAX = 20;
/** How long an instant Réunion is planned for. */
export const INSTANT_MINUTES = 60;
export const NOTES_MAX = 10_000;
export const REASON_MAX = 500;
/** How long a Réunion can be planned for, in minutes. */
export const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

const MINUTE = 60 * 1000;
/** The room opens this long before the start, and stays open this long after the planned end. */
export const OPENS_BEFORE_MS = 15 * MINUTE;
export const CLOSES_AFTER_MS = 60 * MINUTE;
/** The reminders: the day before, then shortly before. */
export const DAY_BEFORE_MS = 24 * 60 * MINUTE;
export const SOON_MS = 15 * MINUTE;

const id = z.string().min(1);

const meetingFields = {
  subject: z.string().trim().min(2).max(SUBJECT_MAX),
  startsAt: z.coerce.date(),
  durationMinutes: z
    .number()
    .int()
    .refine((minutes) => (DURATIONS as readonly number[]).includes(minutes), 'MEETING_DURATION_INVALID'),
};

const description = z.string().trim().max(DESCRIPTION_MAX).nullable();
const participantIds = z.array(id).max(PARTICIPANTS_MAX);

/** A Réunion planned ahead, from a Dossier (its Client invited) or on its own; recorded unless switched off. */
export const scheduleInput = z.object({
  dossierId: id.nullable(),
  ...meetingFields,
  description,
  participantIds,
  recording: z.boolean(),
});
/** Moved, renamed, made longer, or other people invited: the participants are told again. */
export const updateMeetingInput = z.object({ id, ...meetingFields, description, participantIds, recording: z.boolean() });
/** « Réunion instantanée »: it starts now; the people invited are told at once. */
export const instantInput = z.object({
  subject: z.string().trim().max(SUBJECT_MAX),
  dossierId: id.nullable(),
  participantIds,
  recording: z.boolean(),
});
export const tokenInput = z.object({ token: z.string().min(16).max(100) });
export const decideRequestInput = z.object({ id, admit: z.boolean() });
export const peopleSearchInput = z.object({ query: z.string().trim().min(2).max(100) });
export const MEETING_LISTS = ['upcoming', 'past'] as const;
export const meetingListInput = z.object({ list: z.enum(MEETING_LISTS) });
export const cancelMeetingInput = z.object({ id, reason: z.string().trim().max(REASON_MAX) });
export const notesInput = z.object({ id, notes: z.string().max(NOTES_MAX) });
export const joinInput = z.object({ id, accepted: z.boolean() });
export const searchInput = z.object({ dossierId: id, query: z.string().trim().min(2).max(100) });

type Timing = { startsAt: Date; durationMinutes: number; kind?: 'SCHEDULED' | 'INSTANT' | 'PERSONAL'; endedAt?: Date | null };

export const endsAt = (meeting: Timing): Date => new Date(meeting.startsAt.getTime() + meeting.durationMinutes * MINUTE);

/**
 * Whether the room can be joined at `now`: from 15 minutes before the start
 * to an hour after the planned end, unless ended for everyone. The Salle
 * personnelle is always open.
 */
export function isJoinable(meeting: Timing, now: Date): boolean {
  if (meeting.kind === 'PERSONAL') return true;
  if (meeting.endedAt) return false;
  const time = now.getTime();
  return time >= meeting.startsAt.getTime() - OPENS_BEFORE_MS && time <= endsAt(meeting).getTime() + CLOSES_AFTER_MS;
}

/** Whether the Réunion is over: ended for everyone, or past its room's closing. The Salle personnelle never is. */
export const isPast = (meeting: Timing, now: Date): boolean =>
  meeting.kind !== 'PERSONAL' &&
  (Boolean(meeting.endedAt) || now.getTime() > endsAt(meeting).getTime() + CLOSES_AFTER_MS);

/** The Stream call a Réunion is held in. */
export const callIdOf = (meetingId: string): string => `meeting_${meetingId}`;
export const meetingIdOf = (callCid: string): string | null => {
  const match = /^default:meeting_(.+)$/.exec(callCid);
  return match ? match[1]! : null;
};

/**
 * A Transcription as plain text, one line per thing said: Stream gives JSON
 * lines (`{ type: 'speech', speaker_id, text, … }`); `names` turns the
 * speakers' Account ids into names. Lines it can't read are skipped.
 */
export function transcriptText(jsonl: string, names: Record<string, string>): string {
  const lines: string[] = [];
  for (const raw of jsonl.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const entry = JSON.parse(raw) as { type?: string; speaker_id?: string; text?: string };
      if (entry.type !== undefined && entry.type !== 'speech') continue;
      const words = entry.text?.trim();
      if (!words) continue;
      const speaker = entry.speaker_id ? (names[entry.speaker_id] ?? entry.speaker_id) : '';
      lines.push(speaker ? `${speaker} : ${words}` : words);
    } catch {
      // Not a JSON line: skipped.
    }
  }
  return lines.join('\n');
}

/** Where a Réunion's room is, for a Client or partner (« Mon espace ») or the consultant (Tableau de bord). */
export const clientRoomPath = (meetingId: string): string => `/mon-espace/reunions/${meetingId}`;
export const consultantRoomPath = (meetingId: string): string => `/reunions/${meetingId}`;
/** The invitation link's path on the site (signed in only; the uninvited wait to be let in). */
export const invitationPath = (token: string): string => `/reunion/${token}`;

/** A fresh invitation token: 24 random bytes, as 32 URL-safe characters. */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** A recording's file, through our route (consultant only). */
export const recordingUrl = (recordingId: string): string => `/api/meetings/recordings/${recordingId}`;
