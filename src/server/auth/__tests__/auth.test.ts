import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';

import { createAuth } from '@/server/auth/create-auth';
import type { EmailMessage, Mailer } from '@/server/email/mailer';

/**
 * Seam: the auth setup function, exercised over HTTP through `auth.handler`
 * exactly as the browser would, with an in-memory database and a mailer that
 * records what it would have sent. No Prisma, no network.
 */
const BASE_URL = 'http://localhost:3000';

function createHarness() {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    async send(message) {
      sent.push(message);
    },
  };
  const db: Record<string, unknown[]> = {
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
  });

  let cookie = '';

  async function request(
    path: string,
    init: { method?: string; body?: unknown; ip?: string } = {},
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${BASE_URL}/api/auth${path}`;
    const headers = new Headers({
      origin: BASE_URL,
      'x-forwarded-for': init.ip ?? '203.0.113.7',
    });
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (cookie) headers.set('cookie', cookie);
    const res = await auth.handler(
      new Request(url, {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
    const setCookies = res.headers.getSetCookie();
    if (setCookies.length > 0) {
      const jar = new Map(
        cookie
          .split('; ')
          .filter(Boolean)
          .map((c) => c.split('=') as [string, string]),
      );
      for (const c of setCookies) {
        const [pair] = c.split(';');
        const [name, ...rest] = pair!.split('=');
        const value = rest.join('=');
        if (value === '' || /max-age=0/i.test(c)) jar.delete(name!);
        else jar.set(name!, value);
      }
      cookie = [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
    }
    return res;
  }

  async function currentSession(): Promise<{ user: { email: string } } | null> {
    const res = await request('/get-session');
    return (await res.json()) as { user: { email: string } } | null;
  }

  function lastLinkTo(email: string): string {
    const message = [...sent].reverse().find((m) => m.to === email);
    if (!message) throw new Error(`no email sent to ${email}`);
    const match = message.text.match(/https?:\/\/\S+/);
    if (!match) throw new Error('email has no link');
    return match[0];
  }

  return { auth, sent, request, currentSession, lastLinkTo };
}

const AMINATA = {
  name: 'Aminata Diallo',
  email: 'aminata@example.com',
  password: 'correct-horse-battery',
};

describe('email/password sign-up, verification and sign-in', () => {
  it('emails a verification link on sign-up and refuses sign-in until it is followed', async () => {
    const h = createHarness();

    const signUp = await h.request('/sign-up/email', { body: AMINATA });
    expect(signUp.status).toBe(200);
    expect(h.sent.map((m) => m.to)).toEqual([AMINATA.email]);
    expect(await h.currentSession()).toBeNull();

    const early = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: AMINATA.password },
    });
    expect(early.status).toBe(403);
    expect(((await early.json()) as { code: string }).code).toBe(
      'EMAIL_NOT_VERIFIED',
    );

    await h.request(h.lastLinkTo(AMINATA.email));
    expect((await h.currentSession())?.user.email).toBe(AMINATA.email);
  });

  async function verifiedAccount() {
    const h = createHarness();
    await h.request('/sign-up/email', { body: AMINATA });
    await h.request(h.lastLinkTo(AMINATA.email));
    await h.request('/sign-out', { body: {} });
    return h;
  }

  it('signs out, then signs back in with the right password', async () => {
    const h = await verifiedAccount();
    expect(await h.currentSession()).toBeNull();

    const res = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: AMINATA.password },
    });
    expect(res.status).toBe(200);
    expect((await h.currentSession())?.user.email).toBe(AMINATA.email);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const h = await verifiedAccount();

    const wrongPassword = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: 'not-the-password' },
    });
    const unknownEmail = await h.request('/sign-in/email', {
      body: { email: 'nobody@example.com', password: 'not-the-password' },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(((await wrongPassword.json()) as { code: string }).code).toBe(
      ((await unknownEmail.json()) as { code: string }).code,
    );
  });

  it('answers a sign-up for an existing email exactly like a new one, without a second Account', async () => {
    const h = await verifiedAccount();

    const again = await h.request('/sign-up/email', {
      body: { ...AMINATA, password: 'another-long-password' },
      ip: '198.51.100.20',
    });
    expect(again.status).toBe(200);

    const signIn = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: 'another-long-password' },
    });
    expect(signIn.status).toBe(401);
  });

  it('rejects passwords shorter than ten characters', async () => {
    const h = createHarness();
    const res = await h.request('/sign-up/email', {
      body: { ...AMINATA, password: 'short-pw' },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('PASSWORD_TOO_SHORT');
    expect(h.sent).toEqual([]);
  });

  it('rate-limits repeated sign-in attempts from one address', async () => {
    const h = await verifiedAccount();
    const attempt = () =>
      h.request('/sign-in/email', {
        body: { email: AMINATA.email, password: 'not-the-password' },
        ip: '192.0.2.50',
      });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it('never rate-limits the session check every page makes', async () => {
    const h = await verifiedAccount();
    const statuses = new Set<number>();
    // Better Auth's default limit is 100 requests / 10 s per address.
    for (let i = 0; i < 120; i++) {
      statuses.add((await h.request('/get-session', { ip: '192.0.2.60' })).status);
    }
    expect([...statuses]).toEqual([200]);
  });
});

describe('verification email language', () => {
  it('is French by default', async () => {
    const h = createHarness();
    await h.request('/sign-up/email', { body: AMINATA });
    expect(h.sent[0]?.subject).toBe('Confirmez votre adresse e-mail — Stanzy');
    expect(h.sent[0]?.text).toContain('Bonjour Aminata Diallo,');
  });

  it('follows the locale the Account signed up in', async () => {
    const h = createHarness();
    await h.request('/sign-up/email', { body: { ...AMINATA, locale: 'en' } });
    expect(h.sent[0]?.subject).toBe('Confirm your email address — Stanzy');
  });

  it('falls back to French for an unsupported locale', async () => {
    const h = createHarness();
    await h.request('/sign-up/email', { body: { ...AMINATA, locale: 'xx' } });
    expect(h.sent[0]?.subject).toBe('Confirmez votre adresse e-mail — Stanzy');
  });
});
