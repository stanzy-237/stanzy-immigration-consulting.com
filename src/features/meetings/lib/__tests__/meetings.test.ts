import { describe, expect, it } from 'vitest';

import { meetingEmail } from '@/features/meetings/lib/meeting-emails';
import {
  isJoinable,
  isPast,
  meetingIdOf,
  scheduleInput,
  transcriptText,
} from '@/features/meetings/lib/meeting-schema';
import { matchingLines } from '@/features/meetings/server/meetings-router';

const meeting = { startsAt: new Date('2026-11-10T13:00:00Z'), durationMinutes: 30 };
const at = (iso: string) => new Date(iso);

describe('the room', () => {
  it('opens 15 minutes before and closes an hour after the planned end', () => {
    expect(isJoinable(meeting, at('2026-11-10T12:44:00Z'))).toBe(false);
    expect(isJoinable(meeting, at('2026-11-10T12:45:00Z'))).toBe(true);
    expect(isJoinable(meeting, at('2026-11-10T14:30:00Z'))).toBe(true);
    expect(isJoinable(meeting, at('2026-11-10T14:31:00Z'))).toBe(false);
    expect(isPast(meeting, at('2026-11-10T14:31:00Z'))).toBe(true);
  });

  it('finds its Réunion from Stream’s call', () => {
    expect(meetingIdOf('default:meeting_abc123')).toBe('abc123');
    expect(meetingIdOf('default:room-1')).toBeNull();
  });

  it('takes only the durations offered', () => {
    const base = {
      dossierId: 'dos_1',
      subject: 'Point',
      description: null,
      participantIds: [],
      startsAt: '2026-11-10T13:00:00Z',
      recording: true,
    };
    expect(scheduleInput.safeParse({ ...base, durationMinutes: 30 }).success).toBe(true);
    expect(scheduleInput.safeParse({ ...base, durationMinutes: 37 }).success).toBe(false);
  });
});

describe('the Transcription', () => {
  it('reads Stream’s JSON lines as « Name : words », skipping the rest', () => {
    const jsonl = [
      JSON.stringify({ type: 'speech', speaker_id: 'acc_1', text: 'Bonjour.' }),
      JSON.stringify({ type: 'speech', speaker_id: 'acc_stanzy', text: ' Parlons de la preuve de fonds. ' }),
      JSON.stringify({ type: 'other', text: 'ignored' }),
      'not json',
      '',
    ].join('\n');
    expect(transcriptText(jsonl, { acc_1: 'Aminata Diallo', acc_stanzy: 'Stanzy' })).toBe(
      'Aminata Diallo : Bonjour.\nStanzy : Parlons de la preuve de fonds.',
    );
  });

  it('gives the lines that say what was searched', () => {
    expect(matchingLines('A : bonjour\nB : la PREUVE de fonds\nA : merci', 'preuve')).toEqual(['B : la PREUVE de fonds']);
  });
});

describe('the Réunion emails', () => {
  const facts = { subject: 'Point sur la preuve de fonds', startsAt: meeting.startsAt, durationMinutes: 30, recording: true };

  it('gives the moment in Douala time, the length, and that it is recorded', () => {
    const email = meetingEmail({
      to: 'aminata@example.com',
      name: 'Aminata Diallo',
      locale: 'fr',
      kind: 'scheduled',
      meeting: facts,
      url: 'https://stanzy.test/fr/mon-espace/dossiers/dos_1/reunions/m_1',
    });
    expect(email.subject).toBe('Réunion planifiée : Point sur la preuve de fonds');
    expect(email.text).toContain('mardi 10 novembre 2026 à 14:00 (heure de Douala)');
    expect(email.text).toContain('pour 30 minutes');
    expect(email.text).toContain('enregistrée et transcrite');
    expect(email.html).toContain('Rejoindre la réunion');
  });

  it('says why a Réunion was cancelled, and leads to the Dossier', () => {
    const email = meetingEmail({
      to: 'a@x.com',
      name: 'Aminata',
      locale: 'en',
      kind: 'cancelled',
      meeting: facts,
      reason: 'Moved to next week',
      url: 'https://stanzy.test/en/mon-espace/dossiers/dos_1#reunions',
    });
    expect(email.subject).toBe('Meeting cancelled: Point sur la preuve de fonds');
    expect(email.text).toContain('Reason: Moved to next week');
    expect(email.text).not.toContain('recorded');
    expect(email.html).toContain('Open my file');
  });
});
