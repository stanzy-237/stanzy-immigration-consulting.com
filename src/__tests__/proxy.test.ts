import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import proxy from '@/proxy';

/**
 * Seam: the Next proxy, called the way Next calls it. It only checks that a
 * session cookie is present (the authoritative check is in layouts and
 * procedures) and otherwise leaves locale handling to next-intl.
 */
const SESSION_COOKIE = 'better-auth.session_token=signed.token';

function visit(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
}

function redirectTarget(response: Response): URL | null {
  const location = response.headers.get('location');
  return location ? new URL(location) : null;
}

describe('proxy', () => {
  it('sends a signed-out visitor from /compte to Connexion with next', async () => {
    const target = redirectTarget(await visit('/fr/compte'));
    expect(target?.pathname).toBe('/fr/connexion');
    expect(target?.searchParams.get('next')).toBe('/compte');
  });

  it('keeps the locale, sub-path and query string in the redirect', async () => {
    const target = redirectTarget(await visit('/en/compte/securite?onglet=2fa'));
    expect(target?.pathname).toBe('/en/connexion');
    expect(target?.searchParams.get('next')).toBe('/compte/securite?onglet=2fa');
  });

  it('lets a visitor with a session cookie through to /compte', async () => {
    const response = await visit('/fr/compte', SESSION_COOKIE);
    expect(redirectTarget(response)).toBeNull();
  });

  it('accepts the secure session cookie used over HTTPS', async () => {
    const response = await visit('/fr/compte', `__Secure-${SESSION_COOKIE}`);
    expect(redirectTarget(response)).toBeNull();
  });

  it('leaves public pages alone for signed-out visitors', async () => {
    expect(redirectTarget(await visit('/fr/outils/crs'))).toBeNull();
    expect(redirectTarget(await visit('/fr/connexion'))).toBeNull();
    // Only the /compte segment is protected, not lookalikes.
    expect(redirectTarget(await visit('/fr/comptes'))).toBeNull();
  });

  it('still lets next-intl add the missing locale prefix first', async () => {
    const target = redirectTarget(await visit('/compte'));
    expect(target?.pathname).toBe('/fr/compte');
  });
});
