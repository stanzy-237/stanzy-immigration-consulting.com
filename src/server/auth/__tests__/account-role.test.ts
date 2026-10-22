import { describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const PASSWORD = 'correct-horse-battery';

type SessionUser = { email: string; status: string; role: string };

/** Signs up, follows the verification link (which signs in) and reads the session. */
async function signUpAndVerify(
  h: ReturnType<typeof createHarness>,
  body: { name: string; email: string } & Record<string, unknown>,
): Promise<SessionUser> {
  const signUp = await h.request('/sign-up/email', { body: { password: PASSWORD, ...body } });
  expect(signUp.status).toBe(200);
  await h.request(h.lastLinkTo(body.email.toLowerCase()));
  const session = (await h.currentSession(true)) as { user: SessionUser } | null;
  if (!session) throw new Error('not signed in after verification');
  return session.user;
}

describe('Account status and role', () => {
  it('starts every new Account as a User with the member role', async () => {
    const h = createHarness({ consultantEmails: ['stanzy@example.com'] });

    const account = await signUpAndVerify(h, { name: 'Aminata', email: 'aminata@example.com' });

    expect(account).toMatchObject({ status: 'USER', role: 'MEMBER' });
  });

  it('makes an Account whose email is in CONSULTANT_EMAILS the consultant, whatever the case', async () => {
    const h = createHarness({ consultantEmails: ['stanzy@example.com'] });

    const account = await signUpAndVerify(h, { name: 'Stanzy', email: 'Stanzy@Example.com' });

    expect(account).toMatchObject({ status: 'USER', role: 'CONSULTANT' });
  });

  it('never lets sign-up input set the status or the role', async () => {
    const h = createHarness();

    const account = await signUpAndVerify(h, {
      name: 'Mallory',
      email: 'mallory@example.com',
      status: 'CLIENT',
      role: 'CONSULTANT',
    });

    expect(account).toMatchObject({ status: 'USER', role: 'MEMBER' });
  });
});
