import { describe, expect, it } from 'vitest';

import type { AccountRole, AccountStatus } from '@/features/auth/lib/account-status';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import {
  consultantProcedure,
  createCallerFactory,
  createTRPCRouter,
  statusProcedure,
} from '@/server/trpc/trpc';

/**
 * Seam: the role and status guards through a server-side caller, mounted on a
 * throwaway router the way a feature router would use them.
 */
const router = createTRPCRouter({
  adminOnly: consultantProcedure.query(() => 'ok'),
  leadsOnly: statusProcedure('LEAD').query(() => 'ok'),
  clientsOnly: statusProcedure('CLIENT').query(() => 'ok'),
});

function callerAs(session: CurrentSession | null) {
  const ctx = {
    prisma: {} as TRPCContext['prisma'],
    headers: new Headers(),
    session,
  } satisfies TRPCContext;
  return createCallerFactory(router)(ctx);
}

function signedInAs(status: AccountStatus, role: AccountRole = 'MEMBER'): CurrentSession {
  return {
    account: {
      id: 'acc_1',
      name: 'Aminata Diallo',
      email: 'aminata@example.com',
      emailVerified: true,
      image: null,
      locale: 'fr',
      status,
      role,
    },
    session: { id: 'ses_1', expiresAt: new Date('2026-11-01T00:00:00Z') },
  };
}

describe('consultantProcedure', () => {
  it('rejects a signed-out call as UNAUTHORIZED', async () => {
    await expect(callerAs(null).adminOnly()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a member, even a Client, as FORBIDDEN', async () => {
    await expect(callerAs(signedInAs('CLIENT')).adminOnly()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets the consultant through', async () => {
    expect(await callerAs(signedInAs('USER', 'CONSULTANT')).adminOnly()).toBe('ok');
  });
});

describe('statusProcedure', () => {
  it('rejects a signed-out call as UNAUTHORIZED', async () => {
    await expect(callerAs(null).leadsOnly()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it.each([
    ['leadsOnly', 'USER'],
    ['clientsOnly', 'USER'],
    ['clientsOnly', 'LEAD'],
  ] as const)('%s rejects a %s as FORBIDDEN', async (procedure, status) => {
    await expect(callerAs(signedInAs(status))[procedure]()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it.each([
    ['leadsOnly', 'LEAD'],
    ['leadsOnly', 'CLIENT'],
    ['clientsOnly', 'CLIENT'],
  ] as const)('%s lets a %s through', async (procedure, status) => {
    expect(await callerAs(signedInAs(status))[procedure]()).toBe('ok');
  });

  it('lets the consultant pass every status check, whatever their own status', async () => {
    const consultant = callerAs(signedInAs('USER', 'CONSULTANT'));
    expect(await consultant.leadsOnly()).toBe('ok');
    expect(await consultant.clientsOnly()).toBe('ok');
  });
});
