import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';

/**
 * Seam: the i18n routing configuration. Locks in the French-first contract
 * (GLOSSARY.md) so a change to the supported locales or the default is a
 * deliberate, visible edit.
 */
describe('i18n routing', () => {
  it('defaults to French', () => {
    expect(routing.defaultLocale).toBe('fr');
  });

  it('supports exactly French and English', () => {
    expect([...routing.locales].sort()).toEqual(['en', 'fr']);
  });
});
