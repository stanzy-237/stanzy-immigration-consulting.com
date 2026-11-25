/**
 * « Ajouter au calendrier » (`6 Confirmée`): the Consultation opened in the
 * payer's own calendar, never a file to look for in Téléchargements. Google
 * and Outlook have a page that opens the event ready to save; Apple Calendar
 * (iPhone, Mac) opens an .ics the site serves inline (`calendarPath`).
 */
export type CalendarEvent = { id: string; title: string; startsAt: Date; minutes: number; url: string; details: string };

/** `20261124T080000Z`, as calendars want it. */
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const endOf = (event: CalendarEvent) => new Date(event.startsAt.getTime() + event.minutes * 60_000);

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(endOf(event))}`,
    details: `${event.details}\n${event.url}`,
    location: event.url,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.startsAt.toISOString(),
    enddt: endOf(event).toISOString(),
    body: `${event.details}\n${event.url}`,
    location: event.url,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

/** Text in an .ics line: commas, semicolons and newlines escaped. */
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** The event as an iCalendar file, for Apple Calendar and the rest. */
export function icsFile(event: CalendarEvent, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stanzy Immigration//Consultation//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@stanzy-immigration-consulting.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(endOf(event))}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(`${event.details}\n${event.url}`)}`,
    `URL:${event.url}`,
    `LOCATION:${icsText(event.url)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** The .ics of a paid Consultation, served inline so Apple Calendar opens it: keyed by the payment's random id. */
export const calendarPath = (paymentId: string, locale: string): string => `/api/consultation/calendar/${paymentId}?locale=${locale}`;
