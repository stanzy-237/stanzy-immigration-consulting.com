import { memoryAdapter } from 'better-auth/adapters/memory';

import { createAuth, type AuthDeps } from '@/server/auth/create-auth';
import type { EmailMessage, Mailer } from '@/server/email/mailer';

/**
 * Seam: the auth setup function, exercised over HTTP through `auth.handler`
 * exactly as the browser would, with an in-memory database and a mailer that
 * records what it would have sent. No Prisma, no network.
 */
export const BASE_URL = 'http://localhost:3000';

/** `overrides` swaps in factory dependencies, e.g. `consultantEmails`. */
export function createHarness(overrides: Partial<AuthDeps> = {}) {
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
    ...overrides,
  });

  /**
   * One browser: its own cookie jar against the shared server. The harness
   * itself is the first browser; `browser()` opens another (a second device).
   */
  function browser() {
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

    /** `fresh` skips the 5-minute session cookie cache and asks the database. */
    async function currentSession(
      fresh = false,
    ): Promise<{ user: { email: string } } | null> {
      const res = await request(
        fresh ? '/get-session?disableCookieCache=true' : '/get-session',
      );
      return (await res.json()) as { user: { email: string } } | null;
    }

    return { request, currentSession };
  }

  function lastLinkTo(email: string): string {
    const message = [...sent].reverse().find((m) => m.to === email);
    if (!message) throw new Error(`no email sent to ${email}`);
    const match = message.text.match(/https?:\/\/\S+/);
    if (!match) throw new Error('email has no link');
    return match[0];
  }

  return { auth, sent, ...browser(), browser, lastLinkTo };
}
