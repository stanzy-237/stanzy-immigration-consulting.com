import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import proxy from '@/proxy';

/**
 * Seam: the Next proxy, called the way Next calls it. It only checks that a
 * session cookie is present (the authoritative check is in layouts and
 * procedures) and otherwise leaves locale handling to next-intl.
 */
const SESSION_COOKIE = 'better-auth.session_token=signed.token';

function visit(path: string, cookie?: string, origin = 'http://localhost:3000') {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return proxy(new NextRequest(`${origin}${path}`, { headers }));
}

const ADMIN = 'https://admin.stanzy-immigration-consulting.com';
const onAdmin = (path: string, cookie?: string) => visit(path, cookie, ADMIN);

/** The page Next renders for a request the proxy rewrote, or null. */
function rewrittenTo(response: Response): string | null {
  const rewrite = response.headers.get('x-middleware-rewrite');
  return rewrite ? new URL(rewrite).pathname : null;
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

  it('sends a signed-out visitor from the Parcours to Connexion with next', async () => {
    const target = redirectTarget(await visit('/fr/outils/timeline'));
    expect(target?.pathname).toBe('/fr/connexion');
    expect(target?.searchParams.get('next')).toBe('/outils/timeline');
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

describe('proxy — the Tableau de bord on admin.*', () => {
  it('serves the dashboard pages at the root of the subdomain', async () => {
    expect(rewrittenTo(await onAdmin('/', SESSION_COOKIE))).toBe('/fr/tableau-de-bord');
    expect(rewrittenTo(await onAdmin('/blog/post_7', SESSION_COOKIE))).toBe('/fr/tableau-de-bord/blog/post_7');
  });

  it('sends a signed-out visitor to Connexion on the subdomain, coming back to the same page', async () => {
    const target = redirectTarget(await onAdmin('/blog?statut=brouillon'));
    expect(target?.origin).toBe(ADMIN);
    expect(target?.pathname).toBe('/fr/connexion');
    expect(target?.searchParams.get('next')).toBe('/tableau-de-bord/blog?statut=brouillon');
  });

  it('keeps the sign-in pages on the subdomain', async () => {
    const response = await onAdmin('/fr/connexion?next=%2Ftableau-de-bord');
    expect(redirectTarget(response)).toBeNull();
    expect(rewrittenTo(response)).toBeNull();
    expect(redirectTarget(await onAdmin('/fr/mot-de-passe-oublie'))).toBeNull();
  });

  it('turns the full dashboard address (after signing in) into the short one', async () => {
    const target = redirectTarget(await onAdmin('/fr/tableau-de-bord/blog', SESSION_COOKIE));
    expect(target?.href).toBe(`${ADMIN}/blog`);
    expect(redirectTarget(await onAdmin('/fr/tableau-de-bord', SESSION_COOKIE))?.href).toBe(`${ADMIN}/`);
  });

  it('sends the public site’s pages back to the main domain', async () => {
    expect(redirectTarget(await onAdmin('/fr/outils/crs'))?.href).toBe('https://stanzy-immigration-consulting.com/fr/outils/crs');
  });

  it('moves the dashboard off the main domain', async () => {
    expect(redirectTarget(await visit('/fr/tableau-de-bord/blog', SESSION_COOKIE, 'https://stanzy-immigration-consulting.com'))?.href).toBe(
      `${ADMIN}/blog`,
    );
    expect(redirectTarget(await visit('/en/tableau-de-bord', undefined, 'https://www.stanzy-immigration-consulting.com'))?.href).toBe(
      `${ADMIN}/`,
    );
    expect(redirectTarget(await visit('/fr/tableau-de-bord'))?.href).toBe('http://admin.localhost:3000/');
  });
});
