import { describe, expect, it } from 'vitest';

import { safeNextPath } from '@/features/auth/lib/safe-next-path';

/**
 * Seam: the `next` sanitizer. Whatever arrives in `?next=` is attacker
 * controlled; only same-origin relative paths survive, everything else falls
 * back to home.
 */
describe('safeNextPath', () => {
  it.each([
    ['/compte', '/compte'],
    ['/compte/securite', '/compte/securite'],
    ['/outils/crs?step=2#resultat', '/outils/crs?step=2#resultat'],
    ['/services/accompagnement', '/services/accompagnement'],
  ])('keeps the same-origin path %s', (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    ['/fr/compte', '/compte'],
    ['/en/compte/securite?x=1', '/compte/securite?x=1'],
    ['/en', '/'],
  ])('drops the locale prefix from %s so locale-aware navigation can re-add it', (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    '',
    42,
    ['/compte'],
    'compte',
    '//evil.com',
    '//evil.com/compte',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '/\\/evil.com',
    'https://evil.com',
    'http://localhost:3000/compte',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '%2F%2Fevil.com',
    '/%2F/evil.com',
    '/%2f%2fevil.com',
    '%252F%252Fevil.com',
    '/%5Cevil.com',
    '/%5cevil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    ' //evil.com',
    '/%09/evil.com',
    '/%00',
  ])('falls back to home for %j', (next) => {
    expect(safeNextPath(next)).toBe('/');
  });

  it.each(['/connexion', '/inscription?next=/compte', '/fr/connexion'])(
    'falls back to home for the sign-in pages themselves (%s), which would loop',
    (next) => {
      expect(safeNextPath(next)).toBe('/');
    },
  );
});
