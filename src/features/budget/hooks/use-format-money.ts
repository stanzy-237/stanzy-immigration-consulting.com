'use client';

import { useFormatter } from 'next-intl';
import { useCallback } from 'react';

import { CURRENCY_DECIMALS, type Currency } from '@/features/budget/data/currencies';

/**
 * Formats an amount in the page's locale: « 1 518 000 FCFA », « 1 590,50 $CA ».
 * `rounded` drops the cents, for estimates.
 */
export function useFormatMoney(): (amount: number, currency: Currency, rounded?: boolean) => string {
  const format = useFormatter();
  return useCallback(
    (amount, currency, rounded = false) => {
      const digits = rounded ? 0 : CURRENCY_DECIMALS[currency];
      return format.number(amount, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    },
    [format],
  );
}
