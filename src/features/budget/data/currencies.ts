/** The currencies an Account can keep its budget in; XAF (franc CFA BEAC) first, the default. */
export const CURRENCIES = ['XAF', 'XOF', 'CAD', 'EUR', 'USD', 'MAD', 'TND', 'DZD'] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'XAF';

/**
 * Digits after the decimal point an amount is kept with. The francs CFA have
 * no subunit; the others are stored in cents (the dinar's millimes are not
 * worth tracking for a budget).
 */
export const CURRENCY_DECIMALS: Record<Currency, 0 | 2> = {
  XAF: 0,
  XOF: 0,
  CAD: 2,
  EUR: 2,
  USD: 2,
  MAD: 2,
  TND: 2,
  DZD: 2,
};

/**
 * How many units of each currency 1 CAD buys, approximately. A starting point
 * only: the visitor sees the rate and can type their bank's. Both francs CFA
 * are pegged to the euro at 655,957, so they share a rate.
 */
export const DEFAULT_RATES: Record<Currency, number> = {
  XAF: 440,
  XOF: 440,
  CAD: 1,
  EUR: 0.67,
  USD: 0.72,
  MAD: 6.6,
  TND: 2.1,
  DZD: 95,
};

/** When DEFAULT_RATES were last checked. */
export const RATES_CHECKED_ON = '2026-10-27';
