import { memoryAdapter } from 'better-auth/adapters/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuth } from '@/server/auth/create-auth';
import type { EmailMessage, Mailer } from '@/server/email/mailer';

/**
 * Seam: the auth setup function, driven over HTTP through `auth.handler` the
 * way the browser drives it — start the Google sign-in, then land on the
 * OAuth callback. Google itself is replaced by a stub of its token endpoint
 * that answers with the profile under test, so no network is involved.
 */
const BASE_URL = 'http://localhost:3000';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
};

/** An unsigned JWT: Better Auth decodes the code-flow id token without verifying it. */
function idTokenFor(profile: GoogleProfile): string {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({
      iss: 'https://accounts.google.com',
      aud: 'test-google-client',
      iat: now,
      exp: now + 3600,
      picture: 'https://example.com/avatar.png',
      ...profile,
    }),
    '',
  ].join('.');
}

/** Google answers the code exchange with `profile`; any other request fails the test. */
function stubGoogle(profile: GoogleProfile): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== GOOGLE_TOKEN_ENDPOINT) throw new Error(`unexpected fetch: ${url}`);
      return Response.json({
        access_token: 'google-access-token',
        id_token: idTokenFor(profile),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function createHarness() {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    async send(message) {
      sent.push(message);
    },
  };
  const db: Record<string, Record<string, unknown>[]> = {
    account: [],
    session: [],
    authIdentity: [],
    verification: [],
    rateLimit: [],
  };
  const auth = createAuth({
    database: memoryAdapter(db),
    mailer,
    baseURL: BASE_URL,
    secret: 'test-secret-test-secret-test-secret-32',
    google: { clientId: 'test-google-client', clientSecret: 'test-google-secret' },
  });

  let cookie = '';

  async function request(
    path: string,
    init: { body?: unknown } = {},
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${BASE_URL}/api/auth${path}`;
    const headers = new Headers({ origin: BASE_URL, 'x-forwarded-for': '203.0.113.7' });
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (cookie) headers.set('cookie', cookie);
    const res = await auth.handler(
      new Request(url, {
        method: init.body === undefined ? 'GET' : 'POST',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
    const jar = new Map(
      cookie
        .split('; ')
        .filter(Boolean)
        .map((c) => c.split('=') as [string, string]),
    );
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [name, ...rest] = pair!.split('=');
      const value = rest.join('=');
      if (value === '' || /max-age=0/i.test(c)) jar.delete(name!);
      else jar.set(name!, value);
    }
    cookie = [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
    return res;
  }

  async function currentSession(): Promise<{
    user: { id: string; email: string; emailVerified: boolean };
  } | null> {
    return (await (await request('/get-session')).json()) as never;
  }

  /**
   * "Continuer avec Google": start the sign-in as the button does, let the
   * stubbed Google answer with `profile`, and follow the callback. Returns
   * where the callback sends the browser.
   */
  async function continueWithGoogle(
    profile: GoogleProfile,
    urls: { callbackURL: string; errorCallbackURL?: string },
  ): Promise<string | null> {
    const start = await request('/sign-in/social', {
      body: { provider: 'google', ...urls },
    });
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const google = new URL(url);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe(
      `${BASE_URL}/api/auth/callback/google`,
    );

    stubGoogle(profile);
    const state = google.searchParams.get('state')!;
    const callback = await request(
      `/callback/google?code=fake-code&state=${encodeURIComponent(state)}`,
    );
    vi.unstubAllGlobals();
    return callback.headers.get('location');
  }

  const accounts = (): Record<string, unknown>[] => db.account!;
  const identitiesOf = (accountId: string): string[] =>
    db.authIdentity!.filter((i) => i.userId === accountId).map((i) => String(i.providerId));

  return { sent, request, currentSession, continueWithGoogle, accounts, identitiesOf };
}

const AMINATA = {
  name: 'Aminata Diallo',
  email: 'aminata@example.com',
  password: 'correct-horse-battery',
};

const AMINATA_ON_GOOGLE: GoogleProfile = {
  sub: 'google-sub-aminata',
  email: AMINATA.email,
  email_verified: true,
  name: AMINATA.name,
};

describe('Continuer avec Google', () => {
  it('creates a verified Account on a first Google sign-in and returns to the destination', async () => {
    const h = createHarness();

    const location = await h.continueWithGoogle(AMINATA_ON_GOOGLE, { callbackURL: '/fr' });

    expect(location).toBe('/fr');
    const session = await h.currentSession();
    expect(session?.user.email).toBe(AMINATA.email);
    expect(session?.user.emailVerified).toBe(true);
    expect(h.accounts()).toHaveLength(1);
    expect(h.sent).toEqual([]);
  });

  async function verifiedPasswordAccount() {
    const h = createHarness();
    await h.request('/sign-up/email', { body: AMINATA });
    const link = h.sent.at(-1)!.text.match(/https?:\/\/\S+/)![0];
    await h.request(link);
    const id = (await h.currentSession())!.user.id;
    await h.request('/sign-out', { body: {} });
    return { h, id };
  }

  it('links Google to an existing email/password Account with the same verified email', async () => {
    const { h, id } = await verifiedPasswordAccount();

    const location = await h.continueWithGoogle(AMINATA_ON_GOOGLE, { callbackURL: '/fr' });

    expect(location).toBe('/fr');
    expect((await h.currentSession())?.user.id).toBe(id);
    expect(h.accounts()).toHaveLength(1);
    expect(h.identitiesOf(id).sort()).toEqual(['credential', 'google']);

    // Both sign-in methods now reach the same Account.
    await h.request('/sign-out', { body: {} });
    const password = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: AMINATA.password },
    });
    expect(password.status).toBe(200);
    expect((await h.currentSession())?.user.id).toBe(id);
  });

  it('signs a returning Google user back into the same Account', async () => {
    const h = createHarness();
    await h.continueWithGoogle(AMINATA_ON_GOOGLE, { callbackURL: '/fr' });
    const id = (await h.currentSession())!.user.id;
    await h.request('/sign-out', { body: {} });

    await h.continueWithGoogle(AMINATA_ON_GOOGLE, { callbackURL: '/en' });

    expect((await h.currentSession())?.user.id).toBe(id);
    expect(h.accounts()).toHaveLength(1);
  });

  it('refuses to link to an Account whose email was never verified', async () => {
    // Someone signed up with Aminata's address but never confirmed it; her
    // Google sign-in must not hand that Account (and its password) to her.
    const h = createHarness();
    await h.request('/sign-up/email', { body: AMINATA });

    const location = await h.continueWithGoogle(AMINATA_ON_GOOGLE, {
      callbackURL: '/fr',
      errorCallbackURL: '/fr/connexion',
    });

    expect(location).toBe('/fr/connexion?error=account_not_linked');
    expect(await h.currentSession()).toBeNull();
    expect(h.accounts()).toHaveLength(1);
  });
});
