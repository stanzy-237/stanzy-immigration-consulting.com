import { CURRENCY_DECIMALS, type Currency } from '@/features/budget/data/currencies';

/** Whole units of `currency` as the minor units an amount is stored in. */
export function toMinor(amount: number, currency: Currency): number {
  return Math.round(amount * 10 ** CURRENCY_DECIMALS[currency]);
}

/** Stored minor units back to units of `currency`. */
export function fromMinor(minor: number, currency: Currency): number {
  return minor / 10 ** CURRENCY_DECIMALS[currency];
}

/**
 * A typed amount as a number, accepting French and English writing alike:
 * spaces between thousands, and a comma or a dot before the decimals.
 * Null when it isn't a number.
 */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(compact)) return null;
  return Number(compact);
}
