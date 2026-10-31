/** The currencies a Facture can be in; XAF by default (#79). */
export const CURRENCIES = ['XAF', 'CAD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Digits after the decimal point: amounts are stored in the minor unit (XAF has none). */
export const minorDigits = (currency: Currency): number => (currency === 'XAF' ? 0 : 2);

/** "1 250,5" or "1250.50" → 125050 (CAD); null when it isn't an amount. */
export function toMinor(input: string, currency: Currency): number | null {
  const cleaned = input.replace(/[\s  ]/g, '').replace(',', '.');
  const digits = minorDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 10 ** digits);
}

/** 125050 (CAD) → "1250.50", for an input field. */
export const minorToInput = (minor: number, currency: Currency): string =>
  (minor / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));

export type Line = { quantity: number; unitAmount: number };

export const lineTotal = (line: Line): number => line.quantity * line.unitAmount;

export const invoiceTotal = (lines: Line[]): number => lines.reduce((sum, line) => sum + lineTotal(line), 0);

/**
 * "250 000 FCFA", "1 250,50 $ CA". Plain spaces only, so the text also
 * draws in the PDF's standard font (it has no narrow no-break space).
 */
export function formatMoney(minor: number, currency: Currency, locale: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(minor / 10 ** digits)
    .replace(/[  ]/g, ' ');
}
