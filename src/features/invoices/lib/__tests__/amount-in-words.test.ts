import { describe, expect, it } from 'vitest';

import { amountInWords } from '@/features/invoices/lib/amount-in-words';

describe('amountInWords', () => {
  it('writes French amounts as a receipt does', () => {
    expect(amountInWords(0, 'fr')).toBe('zéro');
    expect(amountInWords(21, 'fr')).toBe('vingt et un');
    expect(amountInWords(71, 'fr')).toBe('soixante et onze');
    expect(amountInWords(80, 'fr')).toBe('quatre-vingts');
    expect(amountInWords(81, 'fr')).toBe('quatre-vingt-un');
    expect(amountInWords(97, 'fr')).toBe('quatre-vingt-dix-sept');
    expect(amountInWords(200, 'fr')).toBe('deux cents');
    expect(amountInWords(201, 'fr')).toBe('deux cent un');
    expect(amountInWords(1000, 'fr')).toBe('mille');
    expect(amountInWords(80000, 'fr')).toBe('quatre-vingt mille');
    expect(amountInWords(250000, 'fr')).toBe('deux cent cinquante mille');
    expect(amountInWords(1_350_500, 'fr')).toBe('un million trois cent cinquante mille cinq cents');
    expect(amountInWords(200_000_000, 'fr')).toBe('deux cents millions');
    expect(amountInWords(2_000_000_000, 'fr')).toBe('deux milliards');
  });

  it('writes English amounts', () => {
    expect(amountInWords(0, 'en')).toBe('zero');
    expect(amountInWords(21, 'en')).toBe('twenty-one');
    expect(amountInWords(250000, 'en')).toBe('two hundred fifty thousand');
    expect(amountInWords(1_350_500, 'en')).toBe('one million three hundred fifty thousand five hundred');
  });
});
