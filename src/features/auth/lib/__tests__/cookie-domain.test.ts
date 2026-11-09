import { describe, expect, it } from 'vitest';

import { toCookieDomain } from '@/features/auth/lib/cookie-domain';

describe('toCookieDomain', () => {
  it('drops the trailing dot Chrome refuses', () => {
    expect(toCookieDomain('stanzy-immigration-consulting.com.')).toBe('stanzy-immigration-consulting.com');
  });

  it('drops a leading dot, spaces and capitals', () => {
    expect(toCookieDomain(' .Stanzy-Immigration-Consulting.com \n')).toBe('stanzy-immigration-consulting.com');
  });

  it('reads unset or empty as no shared domain', () => {
    expect(toCookieDomain(undefined)).toBeUndefined();
    expect(toCookieDomain(' . ')).toBeUndefined();
  });
});
