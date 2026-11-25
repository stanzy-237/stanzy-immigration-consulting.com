import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const bots = vi.hoisted(() => ({ isBotRequest: vi.fn(async () => false) }));
vi.mock('@/server/bot-check', () => bots);
const accounts = vi.hoisted(() => ({ createBookingAccount: vi.fn(async () => ({ id: 'acc_new' })) }));
vi.mock('@/features/consultation/server/booking-account', () => accounts);

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `consultation` booking through a server-side caller, over an in-memory
 * stand-in for the Consultations, Réunions and Comptes. The slot and hold rules run for real;
 * the Compte creation (Better Auth + e-mail) is replaced and watched.
 */
function fakeDatabase({ consultations = [] as Row[], emails = [] as string[] } = {}) {
  const rows: Row[] = consultations.map((c) => ({ ...c }));
  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return (condition as Record<string, unknown>[]).some((w) => matches(row, w));
      if (key === 'NOT') return !matches(row, condition as Record<string, unknown>);
      const value = row[key];
      if (condition === null) return value === null || value === undefined;
      if (typeof condition !== 'object' || condition instanceof Date) return value === condition;
      const c = condition as { gt?: Date; lt?: Date; not?: unknown };
      if (c.gt && !(value instanceof Date && value > c.gt)) return false;
      if (c.lt && !(value instanceof Date && value < c.lt)) return false;
      if ('not' in c && value === c.not) return false;
      return true;
    });
  let seq = 0;
  const db = {
    consultationSettings: { findUnique: async () => null },
    meeting: { findMany: async () => [] },
    account: {
      findUnique: async ({ where }: { where: { email: string } }) => (emails.includes(where.email) ? { id: 'acc_known' } : null),
    },
    consultation: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)).at(-1) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row ? { ...row, account: { name: 'Aminata Diallo', email: 'aminata@example.com' } } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `con_${++seq}`, status: 'HELD', meetingId: null, topics: [], crsScore: null, itaReceived: null, situation: null, ...data };
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const found = rows.filter((r) => matches(r, where));
        for (const row of found) Object.assign(row, data);
        return { count: found.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Object.assign(rows.find((r) => r.id === where.id)!, data),
    },
    consultationPayment: { findFirst: async () => null },
    $executeRaw: async () => 0,
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], rows };
}

const callerFor = (db: TRPCContext['prisma'], session: CurrentSession | null = null) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).consultation;

/** `HH:MM` Douala (UTC+1) on `day`, as the slots give it. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`).toISOString();

const contact = {
  name: 'Aminata Diallo',
  email: 'Aminata@Example.com',
  country: 'CM',
  phone: '6 77 12 34 56',
  whatsappReminders: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  // Monday 23 November 2026, 08:00 in Douala: Tuesday is the first day offered.
  vi.setSystemTime(new Date('2026-11-23T07:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('consultation.book, signed out', () => {
  it('creates their Compte, holds the slot 15 minutes and gives this browser its secret', async () => {
    const { db, rows } = fakeDatabase();
    const result = await callerFor(db).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' });

    expect(accounts.createBookingAccount).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' }),
    );
    expect(result.token).toEqual(expect.any(String));
    expect(result.heldUntil).toEqual(new Date('2026-11-23T07:15:00Z'));
    expect(rows[0]).toMatchObject({ accountId: 'acc_new', status: 'HELD', country: 'CM', phone: '+237677123456' });
    // Only a hash of the secret is kept.
    expect(rows[0]!.holdTokenHash).not.toBe(result.token);
  });

  it('asks to sign in when the e-mail already has a Compte, and creates nothing', async () => {
    const { db, rows } = fakeDatabase({ emails: ['aminata@example.com'] });
    await expect(callerFor(db).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' })).rejects.toThrow('ACCOUNT_EXISTS');
    expect(accounts.createBookingAccount).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('refuses a slot someone else holds, before creating any Compte', async () => {
    const { db } = fakeDatabase({
      consultations: [
        { id: 'con_other', accountId: 'acc_2', status: 'HELD', meetingId: null, startsAt: new Date(at('2026-11-24', '09:00')), durationMinutes: 45, heldUntil: new Date('2026-11-23T07:10:00Z') },
      ],
    });
    await expect(callerFor(db).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' })).rejects.toThrow('SLOT_TAKEN');
    expect(accounts.createBookingAccount).not.toHaveBeenCalled();
  });

  it('turns down a number that is not a real one in their country', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db).book({ start: at('2026-11-24', '09:00'), contact: { ...contact, phone: '12' }, locale: 'fr' })).rejects.toThrow();
  });
});

describe('consultation.book, signed in', () => {
  it('holds it for their Compte with no secret, and gives back the slot they held before', async () => {
    const { db, rows } = fakeDatabase({
      consultations: [
        { id: 'con_before', accountId: 'acc_1', status: 'HELD', meetingId: null, startsAt: new Date(at('2026-11-24', '10:00')), durationMinutes: 45, heldUntil: new Date('2026-11-23T07:10:00Z') },
      ],
    });
    const result = await callerFor(db, sessionFor()).book({ start: at('2026-11-24', '11:00'), contact, locale: 'fr' });

    expect(result.token).toBeNull();
    expect(accounts.createBookingAccount).not.toHaveBeenCalled();
    expect(rows.find((r) => r.id === 'con_before')!.heldUntil).toEqual(new Date('2026-11-23T07:00:00Z'));
    expect((await callerFor(db).slots()).days[0]!.starts).toContain(at('2026-11-24', '10:00'));
  });
});

describe('consultation.slots, with holds', () => {
  it('hides a slot held for someone, and shows it again once the 15 minutes have passed', async () => {
    const held = { id: 'con_1', accountId: 'acc_2', status: 'HELD', meetingId: null, startsAt: new Date(at('2026-11-24', '09:00')), durationMinutes: 45, heldUntil: new Date('2026-11-23T07:10:00Z') };
    const { db } = fakeDatabase({ consultations: [held] });
    expect((await callerFor(db).slots()).days[0]!.starts).not.toContain(at('2026-11-24', '09:00'));

    vi.setSystemTime(new Date('2026-11-23T07:11:00Z'));
    expect((await callerFor(db).slots()).days[0]!.starts).toContain(at('2026-11-24', '09:00'));
  });
});

describe('consultation.booking and prepare', () => {
  async function booked() {
    const fake = fakeDatabase();
    const { id, token } = await callerFor(fake.db).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' });
    return { ...fake, id, token: token! };
  }

  it('shows the booking to the browser holding its secret, and to no one else', async () => {
    const { db, id, token } = await booked();
    const booking = await callerFor(db).booking({ id, token });
    expect(booking).toMatchObject({ held: true, contact: { country: 'CM', phone: '+237677123456' } });

    await expect(callerFor(db).booking({ id, token: 'x'.repeat(43) })).rejects.toThrow('NOT_FOUND');
    await expect(callerFor(db, sessionFor({ id: 'acc_2' })).booking({ id })).rejects.toThrow('NOT_FOUND');
  });

  it('saves what they prepared, without empty text', async () => {
    const { db, rows, id, token } = await booked();
    await callerFor(db).prepare({
      id,
      token,
      answers: { topics: ['eligibility', 'points', 'points'], crsScore: 452, itaReceived: false, situation: '  ' },
    });
    expect(rows[0]).toMatchObject({ topics: ['eligibility', 'points'], crsScore: 452, itaReceived: false, situation: null });
  });

  it('refuses once the 15 minutes have passed: the slot was released', async () => {
    const { db, id, token } = await booked();
    vi.setSystemTime(new Date('2026-11-23T07:16:00Z'));
    expect((await callerFor(db).booking({ id, token })).held).toBe(false);
    await expect(
      callerFor(db).prepare({ id, token, answers: { topics: [], crsScore: null, itaReceived: null, situation: null } }),
    ).rejects.toThrow('HOLD_EXPIRED');
  });

  it('changes the country and number while held; the name and e-mail stay the Compte’s', async () => {
    const { db, rows, id, token } = await booked();
    await callerFor(db).contact({ id, token, contact: { ...contact, country: 'CI', phone: '07 07 07 07 07', name: 'Someone Else', email: 'x@example.com' } });
    expect(rows[0]).toMatchObject({ country: 'CI', phone: '+2250707070707' });
  });
});

describe('consultation.book, « Changer »', () => {
  it('lets a signed-out browser move its hold to another slot, for the Compte it created, answers and all', async () => {
    const fake = fakeDatabase();
    const first = await callerFor(fake.db).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' });
    await callerFor(fake.db).prepare({ id: first.id, token: first.token!, answers: { topics: ['documents'], crsScore: 470, itaReceived: true, situation: 'Infirmière' } });
    vi.clearAllMocks();

    const second = await callerFor(fake.db).book({
      start: at('2026-11-24', '11:00'),
      contact,
      locale: 'fr',
      previous: { id: first.id, token: first.token! },
    });

    expect(accounts.createBookingAccount).not.toHaveBeenCalled();
    expect(fake.rows.find((r) => r.id === second.id)).toMatchObject({ accountId: 'acc_new', status: 'HELD' });
    expect(second.token).toEqual(expect.any(String));
    expect(fake.rows.find((r) => r.id === second.id)).toMatchObject({ topics: ['documents'], crsScore: 470, itaReceived: true, situation: 'Infirmière' });
    // The first slot is free again.
    expect((await callerFor(fake.db).slots()).days[0]!.starts).toContain(at('2026-11-24', '09:00'));
  });

  it('lets a signed-in booker book the very slot they hold again, after editing their details', async () => {
    const { db } = fakeDatabase();
    await callerFor(db, sessionFor()).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' });
    await expect(callerFor(db, sessionFor()).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' })).resolves.toMatchObject({ token: null });
  });
});

describe('consultation.current', () => {
  it('finds the slot the signed-in Compte holds, back from the verification link', async () => {
    const { db } = fakeDatabase();
    const { id } = await callerFor(db, sessionFor()).book({ start: at('2026-11-24', '09:00'), contact, locale: 'fr' });
    expect(await callerFor(db, sessionFor()).current()).toMatchObject({ id });
    expect(await callerFor(db).current()).toBeNull();
  });
});
