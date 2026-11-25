import { describe, expect, it } from 'vitest';

import { googleCalendarUrl, icsFile, outlookCalendarUrl } from '@/features/consultation/lib/calendar-links';

const event = {
  id: 'meet_1',
  title: 'Consultation vidéo avec Stanzy',
  details: 'Dans Mon espace, « Rejoindre » s’ouvre 15 minutes avant.',
  startsAt: new Date('2026-11-25T08:00:00Z'),
  minutes: 45,
  url: 'https://www.stanzy-immigration-consulting.com/fr/mon-espace/reunions/meet_1',
};

describe('« Ajouter au calendrier »', () => {
  it('opens Google Calendar on the event, start and end in UTC', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.host).toBe('calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261125T080000Z/20261125T084500Z');
    expect(url.searchParams.get('text')).toBe('Consultation vidéo avec Stanzy');
  });

  it('opens Outlook’s compose page on the event', () => {
    const url = new URL(outlookCalendarUrl(event));
    expect(url.searchParams.get('startdt')).toBe('2026-11-25T08:00:00.000Z');
    expect(url.searchParams.get('enddt')).toBe('2026-11-25T08:45:00.000Z');
  });

  it('writes the .ics with a reminder 15 minutes before, its text escaped', () => {
    const ics = icsFile(event, new Date('2026-11-24T10:00:00Z'));
    expect(ics).toContain('DTSTART:20261125T080000Z');
    expect(ics).toContain('DTEND:20261125T084500Z');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('DESCRIPTION:Dans Mon espace\\, « Rejoindre » s’ouvre 15 minutes avant.\\nhttps://');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
