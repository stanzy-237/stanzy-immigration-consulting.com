import { describe, expect, it } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/** Seam: `accounts.dashboard` through a server-side caller over an in-memory account table. */
type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  locale: string;
  createdAt: Date;
};

const people: Account[] = [
  {
    id: 'acc_stanzy',
    name: 'Stanzy',
    email: 'stanzy@example.com',
    role: 'CONSULTANT',
    status: 'USER',
    locale: 'fr',
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'acc_1',
    name: 'Aminata Diallo',
    email: 'aminata@example.com',
    role: 'MEMBER',
    status: 'CLIENT',
    locale: 'fr',
    createdAt: new Date('2026-10-01'),
  },
  {
    id: 'acc_2',
    name: 'Bob Martin',
    email: 'bob@example.com',
    role: 'MEMBER',
    status: 'USER',
    locale: 'en',
    createdAt: new Date('2026-11-01'),
  },
];

function matches(account: Account, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') {
      return (condition as Record<string, { contains: string }>[]).some((alt) =>
        Object.entries(alt).every(([field, c]) =>
          String(account[field as keyof Account])
            .toLowerCase()
            .includes(c.contains.toLowerCase()),
        ),
      );
    }
    if (condition && typeof condition === 'object' && 'not' in condition) {
      return account[key as keyof Account] !== (condition as { not: string }).not;
    }
    return account[key as keyof Account] === condition;
  });
}

const prisma = {
  account: {
    async findMany({ where }: { where: Record<string, unknown> }) {
      return people.filter((a) => matches(a, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return people.filter((a) => matches(a, where)).length;
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      const found = people.find((a) => matches(a, where));
      return found ? { ...found, dossiers: [] } : null;
    },
  },
} as unknown as TRPCContext['prisma'];

const as = (session: CurrentSession) => createCaller({ prisma, headers: new Headers(), session }).accounts.dashboard;
const consultant = sessionFor({ id: 'acc_stanzy', role: 'CONSULTANT' });

describe('« Comptes »', () => {
  it('lists every Account but the consultant’s, newest first, by name or email and status', async () => {
    expect((await as(consultant).list({ query: '', status: 'ALL' })).accounts.map((a) => a.id)).toEqual([
      'acc_2',
      'acc_1',
    ]);
    expect((await as(consultant).list({ query: 'AMINATA', status: 'ALL' })).accounts.map((a) => a.id)).toEqual([
      'acc_1',
    ]);
    expect((await as(consultant).list({ query: '', status: 'USER' })).total).toBe(1);
  });

  it('opens one Account, never the consultant’s', async () => {
    expect(await as(consultant).get({ id: 'acc_1' })).toMatchObject({ name: 'Aminata Diallo', dossiers: [] });
    await expect(as(consultant).get({ id: 'acc_stanzy' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is for the consultant only', async () => {
    await expect(as(sessionFor()).list({ query: '', status: 'ALL' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
