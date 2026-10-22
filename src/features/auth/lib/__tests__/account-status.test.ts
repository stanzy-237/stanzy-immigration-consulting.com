import { describe, expect, it } from 'vitest';

import {
  hasStatusAtLeast,
  InvalidStatusTransitionError,
  nextStatus,
} from '@/features/auth/lib/account-status';

describe('nextStatus', () => {
  it('moves a User to Lead when onboarding starts', () => {
    expect(nextStatus('USER', 'START_ONBOARDING')).toBe('LEAD');
  });

  it('moves a Lead to Client when they buy Accompagnement', () => {
    expect(nextStatus('LEAD', 'PURCHASE_ACCOMPAGNEMENT')).toBe('CLIENT');
  });

  it.each([
    ['USER', 'PURCHASE_ACCOMPAGNEMENT'], // jump straight to Client
    ['LEAD', 'START_ONBOARDING'], // already a Lead
    ['CLIENT', 'START_ONBOARDING'], // backwards
    ['CLIENT', 'PURCHASE_ACCOMPAGNEMENT'], // already a Client
  ] as const)('refuses %s + %s', (status, event) => {
    expect(() => nextStatus(status, event)).toThrow(InvalidStatusTransitionError);
  });
});

describe('hasStatusAtLeast', () => {
  it.each([
    ['USER', 'USER', true],
    ['USER', 'LEAD', false],
    ['LEAD', 'USER', true],
    ['LEAD', 'CLIENT', false],
    ['CLIENT', 'LEAD', true],
    ['CLIENT', 'CLIENT', true],
  ] as const)('%s is at least %s: %s', (status, min, expected) => {
    expect(hasStatusAtLeast(status, min)).toBe(expected);
  });
});
