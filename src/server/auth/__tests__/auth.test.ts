import { describe, expect, it, vi } from 'vitest';

import { BASE_URL, createHarness } from './harness';

const AMINATA = {
  name: 'Aminata Diallo',
  email: 'aminata@example.com',
  password: 'correct-horse-battery',
};

/** A harness holding Aminata's verified Account, signed out, inbox emptied. */
async function verifiedAccount(...args: Parameters<typeof createHarness>) {
  const h = createHarness(...args);
  await h.request('/sign-up/email', { body: AMINATA });
  await h.request(h.lastLinkTo(AMINATA.email));
  await h.request('/sign-out', { body: {} });
  h.sent.length = 0;
  return h;
}

describe('Mot de passe oublié', () => {
  const RESET_PAGE = '/fr/reinitialiser-mot-de-passe';

  it('answers the same whether or not the email has an Account, and only emails a real one', async () => {
    const h = await verifiedAccount();

    const known = await h.request('/request-password-reset', {
      body: { email: AMINATA.email, redirectTo: RESET_PAGE },
    });
    const unknown = await h.request('/request-password-reset', {
      body: { email: 'nobody@example.com', redirectTo: RESET_PAGE },
    });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(h.sent.map((m) => m.to)).toEqual([AMINATA.email]);
  });

  /** Requests a reset, follows the emailed link, returns where it landed. */
  async function followResetLink(h: Awaited<ReturnType<typeof verifiedAccount>>) {
    await h.request('/request-password-reset', {
      body: { email: AMINATA.email, redirectTo: RESET_PAGE },
    });
    const res = await h.request(h.lastLinkTo(AMINATA.email));
    return new URL(res.headers.get('location') ?? '', BASE_URL);
  }

  it('lands on Réinitialiser le mot de passe, sets the new password and signs the person in', async () => {
    const h = await verifiedAccount();

    const landing = await followResetLink(h);
    expect(landing.pathname).toBe(RESET_PAGE);
    const token = landing.searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await h.request('/reset-password', {
      body: { token, newPassword: 'a-brand-new-password' },
    });
    expect(reset.status).toBe(200);
    expect((await h.currentSession())?.user.email).toBe(AMINATA.email);

    await h.request('/sign-out', { body: {} });
    const oldPassword = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: AMINATA.password },
    });
    expect(oldPassword.status).toBe(401);
    const newPassword = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: 'a-brand-new-password' },
    });
    expect(newPassword.status).toBe(200);
  });

  it('also signs in an Account that never followed its verification link', async () => {
    const h = createHarness();
    await h.request('/sign-up/email', { body: AMINATA });

    const token = (await followResetLink(h)).searchParams.get('token');
    await h.request('/reset-password', { body: { token, newPassword: 'a-brand-new-password' } });

    expect((await h.currentSession())?.user.email).toBe(AMINATA.email);

    // The emailed link proved the address, so it now counts as verified.
    await h.request('/sign-out', { body: {} });
    const signIn = await h.request('/sign-in/email', {
      body: { email: AMINATA.email, password: 'a-brand-new-password' },
    });
    expect(signIn.status).toBe(200);
  });

  it('works only once: the used link lands on the error, and its token is refused', async () => {
    const h = await verifiedAccount();
    const token = (await followResetLink(h)).searchParams.get('token');
    await h.request('/reset-password', { body: { token, newPassword: 'a-brand-new-password' } });

    const again = await h.request('/reset-password', {
      body: { token, newPassword: 'yet-another-password' },
    });
    expect(again.status).toBe(400);
    expect(((await again.json()) as { code: string }).code).toBe('INVALID_TOKEN');

    const relanding = await h.request(h.lastLinkTo(AMINATA.email));
    const location = new URL(relanding.headers.get('location') ?? '', BASE_URL);
    expect(location.pathname).toBe(RESET_PAGE);
    expect(location.searchParams.get('error')).toBe('INVALID_TOKEN');
  });

  it('signs out every other session once the password is reset', async () => {
    const h = await verifiedAccount();
    const otherDevice = h.browser();
    await otherDevice.request('/sign-in/email', {
      body: { email: AMINATA.email, password: AMINATA.password },
    });
    expect((await otherDevice.currentSession(true))?.user.email).toBe(AMINATA.email);

    const token = (await followResetLink(h)).searchParams.get('token');
    await h.request('/reset-password', { body: { token, newPassword: 'a-brand-new-password' } });

    expect(await otherDevice.currentSession(true)).toBeNull();
    expect((await h.currentSession(true))?.user.email).toBe(AMINATA.email);
  });

  it('writes the reset email in the language the Account signed up in', async () => {
    const fr = await verifiedAccount();
    await fr.request('/request-password-reset', { body: { email: AMINATA.email } });
    expect(fr.sent[0]?.subject).toBe('Réinitialisez votre mot de passe — Stanzy');
    expect(fr.sent[0]?.text).toContain('Bonjour Aminata Diallo,');

    const en = createHarness();
    await en.request('/sign-up/email', { body: { ...AMINATA, locale: 'en' } });
    await en.request('/request-password-reset', { body: { email: AMINATA.email } });
    expect(en.sent.at(-1)?.subject).toBe('Reset your password — Stanzy');
  });

  it('rate-limits reset requests from one address', async () => {
    const h = await verifiedAccount();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await h.request('/request-password-reset', {
        body: { email: AMINATA.email, redirectTo: RESET_PAGE },
        ip: '192.0.2.70',
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(h.sent).toHaveLength(3);
  });

  it('expires after an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const h = await verifiedAccount();
      const token = (await followResetLink(h)).searchParams.get('token');

      vi.setSystemTime(Date.now() + 61 * 60 * 1000);

      const late = await h.request('/reset-password', {
        body: { token, newPassword: 'a-brand-new-password' },
      });
      expect(late.status).toBe(400);
      expect(((await late.json()) as { code: string }).code).toBe('INVALID_TOKEN');
      expect(await h.currentSession()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

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
