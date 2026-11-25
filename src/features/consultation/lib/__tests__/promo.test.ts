import { describe, expect, it } from 'vitest';

import { discountFor, nearestCode, normalizeCode, promoCreateSchema, promoStatus } from '@/features/consultation/lib/promo';

describe('Codes promo rules', () => {
  it('reads a code however it is typed', () => {
    expect(normalizeCode(' black friday ')).toBe('BLACKFRIDAY');
    expect(normalizeCode('Noël-24')).toBe('NOEL-24');
  });

  it('takes a percentage (to the franc) or an amount off, never leaving less than 100 FCFA', () => {
    expect(discountFor(15_000, { reductionType: 'PERCENT', reductionValue: 70 })).toBe(10_500);
    expect(discountFor(15_000, { reductionType: 'AMOUNT', reductionValue: 5_000 })).toBe(5_000);
    expect(discountFor(15_000, { reductionType: 'AMOUNT', reductionValue: 20_000 })).toBe(14_900);
  });

  it('is Actif, Épuisé once its places are paid, Terminé after its end', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(promoStatus({ places: 20, endsAt: null }, 13, now)).toBe('ACTIVE');
    expect(promoStatus({ places: 10, endsAt: null }, 10, now)).toBe('SOLD_OUT');
    expect(promoStatus({ places: null, endsAt: new Date('2026-11-24T11:00:00Z') }, 0, now)).toBe('ENDED');
  });

  it('suggests the live code a typo most likely meant', () => {
    expect(nearestCode('BLACKFRYDAY', ['BLACKFRIDAY', 'LANCEMENT'])).toBe('BLACKFRIDAY');
    expect(nearestCode('NOPE', ['BLACKFRIDAY'])).toBeNull();
  });

  it('refuses a percentage over 99 and a code with no service', () => {
    const base = { code: 'x-mas', reductionType: 'PERCENT' as const, reductionValue: 50, services: ['CONSULTATION' as const], places: null, endsAt: null, oncePerAccount: true };
    expect(promoCreateSchema.parse(base).code).toBe('X-MAS');
    expect(promoCreateSchema.safeParse({ ...base, reductionValue: 100 }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...base, services: [] }).success).toBe(false);
  });
});
