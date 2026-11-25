const DOUALA = 'Africa/Douala';

/** A `YYYY-MM-DD` read as that calendar day, whatever the visitor's zone. */
const noon = (day: string): Date => new Date(`${day}T12:00:00Z`);

const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** How a bookable day is written: « jeu. », « 26 », « Jeudi 26 novembre ». */
export function dayLabels(day: string, locale: string): { weekday: string; date: string; long: string } {
  const date = noon(day);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(date);
  return {
    weekday: format({ weekday: 'short' }),
    date: format({ day: 'numeric' }),
    long: capitalize(format({ weekday: 'long', day: 'numeric', month: 'long' })),
  };
}

/** `HH:MM` of an ISO start, heure de Douala. */
export const timeOf = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeZone: DOUALA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** A price in XAF, as the pages write it: « 12 345 FCFA ». */
export const fcfa = (amount: number, locale: string): string => `${new Intl.NumberFormat(locale).format(amount)} FCFA`;

/** The booking step the panel leads to, with the chosen start. */
export const bookingHref = (start: string): string => `/services/consultation/reserver?creneau=${encodeURIComponent(start)}`;

/** The day of an ISO start, heure de Douala: « mar. 25 nov. », or « Mar. 25 » when `short`. */
export function slotDay(iso: string, locale: string, { short = false }: { short?: boolean } = {}): string {
  const text = new Intl.DateTimeFormat(locale, {
    timeZone: DOUALA,
    weekday: 'short',
    day: 'numeric',
    ...(short ? {} : { month: 'short' }),
  }).format(new Date(iso));
  return short ? capitalize(text) : text;
}
