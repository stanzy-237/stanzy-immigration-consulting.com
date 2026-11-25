import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_AVAILABILITY } from '@/features/consultation/lib/availability';
import { forgetNetworks } from '@/features/consultation/server/consultation-payments';
import type { SasPay, SasPayVerdict } from '@/features/consultation/server/saspay';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

vi.mock('@/server/bot-check', () => ({ isBotRequest: vi.fn(async () => false) }));
const mail = vi.hoisted(() => ({ appMailer: { send: vi.fn(async () => {}) } }));
vi.mock('@/server/email/app-mailer', () => mail);
// The Facture's PDF is drawn from the letterhead and the consultant's signature: tested on its own.
const invoice = vi.hoisted(() => ({ consultationInvoice: vi.fn(async () => ({ number: 'STZ-2026-0001', pdf: Buffer.from('%PDF') })) }));
vi.mock('@/features/consultation/server/consultation-invoice', () => invoice);

/** Seam: SasPay itself, as the sandbox's magic numbers would answer. */
const gateway = vi.hoisted(() => ({
  verdict: { status: 'PENDING', currency: null, fee: null, charged: null, netAmount: null } as SasPayVerdict,
  client: null as unknown,
}));
vi.mock('@/features/consultation/server/saspay', async (original) => ({
  ...(await original<typeof import('@/features/consultation/server/saspay')>()),
  saspay: () => gateway.client,
}));

const network = {
  country: 'CM',
  countryName: 'Cameroun',
  currency: 'XAF',
  code: 'mtn_cm',
  name: 'MTN Mobile Money',
  otpRequired: false,
  otpInstructions: '',
  tiers: [{ minAmount: 0, maxAmount: null, percent: 4.75, fixed: 0, floor: null, cap: null }],
};

function fakeSasPay() {
  return {
    networks: vi.fn(async () => [
      network,
      { ...network, country: 'CI', currency: 'XOF', code: 'orange_ci', name: 'Orange Money', otpRequired: true },
      // SasPay lists card and crypto in countries of their own.
      { ...network, country: 'XX', countryName: 'International', currency: 'USD', code: 'card', name: 'Carte bancaire' },
      { ...network, country: 'XY', countryName: 'Crypto', currency: 'USD', code: 'crypto', name: 'Crypto / Stablecoin' },
    ]),
    softpay: vi.fn(async (): Promise<{ id: string; status: 'PENDING'; checkoutUrl: string | null }> => ({ id: 'tx_1', status: 'PENDING', checkoutUrl: null })),
    verify: vi.fn(async () => gateway.verdict),
  };
}

type Row = Record<string, unknown> & { id: string };
const START = new Date('2026-11-24T08:00:00Z'); // mardi 09:00 Douala

/**
 * Seam: `consultation` payments through a server-side caller, over an
 * in-memory stand-in for the Consultations, their payments, Réunions and
 * Comptes. Holding, paying, verifying and delivering run for real.
 */
function fakeDatabase({ meetings = [] as Row[], others = [] as Row[], codes = [] as Row[], paid = [] as Row[] } = {}) {
  const account = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', status: 'USER', role: 'MEMBER' };
  const consultant = { id: 'acc_stanzy', role: 'CONSULTANT' };
  const consultations: Row[] = [
    {
      id: 'con_1',
      accountId: 'acc_1',
      status: 'HELD',
      startsAt: START,
      durationMinutes: 45,
      heldUntil: new Date('2026-11-23T07:15:00Z'),
      holdTokenHash: null,
      promoCodeId: null,
      meetingId: null,
      paidById: null,
      phone: '+237677123450',
      createdAt: new Date('2026-11-23T07:00:00Z'),
    },
    ...others,
  ];
  // `paid`: payments made earlier by others (or this Compte, `accountId`), with a code.
  const payments: Row[] = paid.map((p) => ({ status: 'SUCCESS', createdAt: new Date(), ...p }));
  let invoices = 0;
  const promoCodes: Row[] = codes.map((c) => ({ deletedAt: null, endsAt: null, places: null, oncePerAccount: true, services: ['CONSULTATION'], ...c }));
  const createdMeetings: Row[] = [...meetings];
  const withAccount = (row: Row | undefined) => (row ? { ...row, account } : null);
  const find = (rows: Row[], where: Record<string, unknown>) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v));

  const db = {
    consultationSettings: { findUnique: async () => ({ id: 'default', price: 15000, ...defaults }) },
    meeting: {
      findMany: async () => createdMeetings,
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `meet_${createdMeetings.length + 1}` };
        createdMeetings.push(row);
        return row;
      },
    },
    account: {
      findFirst: async () => consultant,
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (account.status !== where.status) return { count: 0 };
        account.status = data.status;
        return { count: 1 };
      },
    },
    consultation: {
      findUnique: async ({ where }: { where: { id: string } }) => withAccount(find(consultations, where)),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => withAccount(find(consultations, where)),
      findMany: async ({ where }: { where: { NOT?: { accountId: string } } }) =>
        consultations.filter((c) => c.accountId !== where.NOT?.accountId && (c.status === 'PAID' || (c.heldUntil as Date) > new Date())),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(find(consultations, where)!, data),
      updateMany: async ({ where, data }: { where: { id: string; heldUntil: { lt: Date } }; data: Row }) => {
        const row = find(consultations, { id: where.id });
        if (!row || !((row.heldUntil as Date) < where.heldUntil.lt)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    promoCode: {
      findFirst: async ({ where }: { where: Row }) => find(promoCodes, where) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => find(promoCodes, where) ?? null,
      findMany: async () => promoCodes.filter((c) => c.deletedAt === null),
    },
    consultationPayment: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        payments.filter((p) => {
          const ownerOf = (row: Row) => (row.accountId as string | undefined) ?? find(consultations, { id: row.consultationId })?.accountId;
          if (where.promoCodeId !== undefined && p.promoCodeId !== where.promoCodeId) return false;
          if (where.status !== undefined && p.status !== where.status) return false;
          const notCon = (where.consultationId as { not?: string } | undefined)?.not;
          if (notCon !== undefined && p.consultationId === notCon) return false;
          const after = (where.createdAt as { gt?: Date } | undefined)?.gt;
          if (after && !((p.createdAt as Date) > after)) return false;
          const owner = (where.consultation as { accountId?: string } | undefined)?.accountId;
          if (owner !== undefined && ownerOf(p) !== owner) return false;
          return true;
        }).length,
      groupBy: async ({ where }: { where: { promoCodeId: { in: string[] }; status: string } }) => {
        const counts = new Map<string, number>();
        for (const p of payments) {
          if (p.status === where.status && where.promoCodeId.in.includes(p.promoCodeId as string)) counts.set(p.promoCodeId as string, (counts.get(p.promoCodeId as string) ?? 0) + 1);
        }
        return [...counts].map(([promoCodeId, n]) => ({ promoCodeId, _count: { _all: n } }));
      },
      create: async ({ data }: { data: Row }) => {
        const row = { status: 'PENDING', transactionId: null, checkoutId: null, checkoutUrl: null, checkedAt: null, settledAt: null, fee: null, charged: null, netAmount: null, createdAt: new Date(), ...data };
        payments.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(find(payments, where)!, data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const row = find(payments, where);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findFirst: async ({ where }: { where: Row }) => find(payments, where) ?? null,
      findUnique: async ({ where }: { where: Row }) => find(payments, where) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = find(payments, where)!;
        return { ...row, consultation: withAccount(find(consultations, { id: row.consultationId })) };
      },
    },
    invoiceCounter: {
      upsert: async () => ({ year: 2026, last: ++invoices }),
    },
    $executeRaw: async () => 0,
    $transaction: async (work: unknown) => (typeof work === 'function' ? work(db) : Promise.all(work as Promise<unknown>[])),
  };
  return { db: db as unknown as TRPCContext['prisma'], consultations, payments, meetings: createdMeetings, account };
}

const defaults = DEFAULT_AVAILABILITY;

const BLACKFRIDAY = { id: 'promo_bf', code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70, places: 20 };
/** Payments that succeeded with a code, by other bookings. */
const paidWith = (codeId: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `old_${i}`, consultationId: `con_old_${i}`, accountId: `acc_old_${i}`, promoCodeId: codeId }));

/** Signed in as the booker, so the booking is theirs without a browser secret. */
const callerFor = (db: TRPCContext['prisma']) =>
  createCaller({
    prisma: db,
    session: { account: { id: 'acc_1', email: 'aminata@example.com', name: 'Aminata Diallo', role: 'MEMBER' } },
    headers: new Headers(),
  } as unknown as TRPCContext).consultation;

const mtn = { kind: 'network' as const, country: 'CM', network: 'mtn_cm', phone: '6 77 12 34 50' };

let client: ReturnType<typeof fakeSasPay>;
beforeEach(() => {
  vi.clearAllMocks();
  forgetNetworks();
  client = fakeSasPay();
  gateway.client = client as unknown as SasPay;
  gateway.verdict = { status: 'PENDING', currency: null, fee: null, charged: null, netAmount: null };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-23T07:05:00Z'));
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe('consultation.paymentOptions', () => {
  it('lists the country’s Mobile Money networks with their fee on the price, and card apart', async () => {
    const { db } = fakeDatabase();
    const options = await callerFor(db).paymentOptions({ country: 'CM' });
    expect(options).toMatchObject({
      open: true,
      price: 15000,
      networks: [{ code: 'mtn_cm', fee: 713, otpRequired: false }],
      card: { name: 'Carte bancaire', currency: 'USD' },
    });
  });

  it('never offers SasPay’s card or crypto « countries » as a country', async () => {
    const { db } = fakeDatabase();
    expect((await callerFor(db).paymentOptions({ country: 'XX' })).networks).toEqual([]);
    expect((await callerFor(db).paymentOptions({ country: 'CA' })).networks).toEqual([]);
  });

  it('is closed when SasPay is not set up here', async () => {
    gateway.client = null;
    const { db } = fakeDatabase();
    expect(await callerFor(db).paymentOptions({ country: 'CM' })).toMatchObject({ open: false, networks: [] });
  });
});

describe('consultation.pay', () => {
  it('pushes the price to their number with an idempotency key, and keeps the slot while they validate', async () => {
    const { db, payments, consultations } = fakeDatabase();
    const result = await callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn });

    expect(result).toEqual({ paymentId: expect.any(String), checkoutUrl: null });
    expect(client.softpay).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15000, currency: 'XAF', network: 'mtn_cm', customer: expect.objectContaining({ phone: '+237677123450', firstName: 'Aminata', lastName: 'Diallo' }) }),
      payments[0]!.idempotencyKey,
    );
    expect(payments[0]).toMatchObject({ status: 'PENDING', transactionId: 'tx_1', amount: 15000, networkName: 'MTN Mobile Money' });
    // Held 10 more minutes from now (07:05), within 45 minutes of the first hold.
    expect(consultations[0]!.heldUntil).toEqual(new Date('2026-11-23T07:15:00Z'));
  });

  it('asks Orange Money CI for its USSD code before sending anything', async () => {
    const { db } = fakeDatabase();
    await expect(
      callerFor(db).pay({ id: 'con_1', locale: 'fr', method: { kind: 'network', country: 'CI', network: 'orange_ci', phone: '07 07 07 07 07' } }),
    ).rejects.toThrow('OTP_REQUIRED');
    expect(client.softpay).not.toHaveBeenCalled();
  });

  it('keeps a refusal SasPay gives at once as a failed try, and says nothing was sent', async () => {
    const { SasPayError } = await import('@/features/consultation/server/saspay');
    client.softpay.mockRejectedValueOnce(new SasPayError(422, 'no_route_available', 'no route'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, payments } = fakeDatabase();
    await expect(callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn })).rejects.toThrow('PAYMENT_REFUSED');
    expect(payments[0]).toMatchObject({ status: 'FAILED', failureCode: 'no_route_available' });
  });

  it('pays by card on SasPay’s card network, coming back to the payment’s own page', async () => {
    client.softpay.mockResolvedValueOnce({ id: 'tx_card', status: 'PENDING', checkoutUrl: 'https://sandbox-checkout.saspay.me/card/x' });
    const { db, payments } = fakeDatabase();
    const result = await callerFor(db).pay({ id: 'con_1', locale: 'en', method: { kind: 'card', country: 'CA' } });

    expect(result.checkoutUrl).toBe('https://sandbox-checkout.saspay.me/card/x');
    expect(client.softpay).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'XX',
        network: 'card',
        currency: 'XAF',
        customer: expect.objectContaining({ phone: '+237677123450' }),
        returnUrl: expect.stringMatching(new RegExp(`/en/services/consultation/reserver/paiement/${result.paymentId}$`)),
      }),
      expect.any(String),
    );
    expect(payments[0]).toMatchObject({ network: 'card', phone: null, checkoutUrl: 'https://sandbox-checkout.saspay.me/card/x' });
  });

  it('keeps what a card really cost, in the currency SasPay charged it', async () => {
    const { db, payments } = fakeDatabase();
    const { paymentId } = await callerFor(db).pay({ id: 'con_1', locale: 'fr', method: { kind: 'card', country: 'CA' } });
    gateway.verdict = { status: 'SUCCESS', currency: 'USD', fee: '0.35', charged: '2.02', netAmount: '1.67' };
    const view = await callerFor(db).payment({ id: 'con_1', paymentId, force: true });

    expect(view).toMatchObject({ status: 'SUCCESS', settledCurrency: 'USD', charged: 2.02, currency: 'XAF', amount: 15000 });
    expect(payments[0]).toMatchObject({ settledCurrency: 'USD', charged: '2.02' });
    expect(mail.appMailer.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringMatching(/2,02.*\$/) }));
  });

  it('refuses once the hold is over', async () => {
    vi.setSystemTime(new Date('2026-11-23T07:20:00Z'));
    const { db } = fakeDatabase();
    await expect(callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn })).rejects.toThrow('HOLD_EXPIRED');
  });
});

describe('consultation.payment, after paying', () => {
  async function paid(setup: Parameters<typeof fakeDatabase>[0] = {}) {
    const state = fakeDatabase(setup);
    const { paymentId } = await callerFor(state.db).pay({ id: 'con_1', locale: 'fr', method: mtn });
    gateway.verdict = { status: 'SUCCESS', currency: 'XAF', fee: '713.00', charged: '15713.00', netAmount: '15000.00' };
    const view = await callerFor(state.db).payment({ id: 'con_1', paymentId, force: true });
    return { ...state, paymentId, view };
  }

  it('delivers on SUCCESS: paid, its Réunion with the Client invited, a Lead, and the confirmation e-mail', async () => {
    const { view, consultations, meetings, account, payments } = await paid();

    expect(view).toMatchObject({ status: 'SUCCESS', charged: 15713, consultation: { firstName: 'Aminata', meetingId: 'meet_1' } });
    expect(payments[0]).toMatchObject({ status: 'SUCCESS', fee: '713.00', netAmount: '15000.00' });
    expect(consultations[0]).toMatchObject({ status: 'PAID', meetingId: 'meet_1', heldUntil: null, startsAt: START });
    expect(meetings[0]).toMatchObject({ startsAt: START, recording: true, plannedById: 'acc_stanzy', participants: { create: [{ accountId: 'acc_1' }] } });
    expect(account.status).toBe('LEAD');
    // Its Facture payée, numbered with the Dossiers' Factures, attached to the confirmation.
    expect(payments[0]!.invoiceNumber).toBe('STZ-2026-0001');
    expect(view).toMatchObject({ invoiceNumber: 'STZ-2026-0001' });
    expect(mail.appMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [{ filename: 'STZ-2026-0001.pdf', content: expect.any(Buffer) }] }),
    );
    expect(mail.appMailer.send).toHaveBeenCalledTimes(1);
    expect(mail.appMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'aminata@example.com', subject: expect.stringContaining('Votre Consultation est confirmée') }),
    );
  });

  it('delivers once, however often SasPay is asked again', async () => {
    const { db, paymentId, meetings } = await paid();
    await callerFor(db).payment({ id: 'con_1', paymentId, force: true });
    expect(meetings).toHaveLength(1);
    expect(client.verify).toHaveBeenCalledTimes(1);
    expect(mail.appMailer.send).toHaveBeenCalledTimes(1);
  });

  it('moves it to the next free slot when its own was taken while the payment was on its way, and says so', async () => {
    const { consultations, view } = await paid({ meetings: [{ id: 'meet_other', startsAt: START, durationMinutes: 45 }] });
    expect(consultations[0]!.startsAt).not.toEqual(START);
    expect(view.consultation?.startsAt).toEqual(consultations[0]!.startsAt);
    expect(mail.appMailer.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('créneau libre suivant') }));
  });

  it('on FAILED tells them nothing was charged and the slot stays held, without delivering', async () => {
    const { db, consultations } = fakeDatabase();
    const { paymentId } = await callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn });
    gateway.verdict = { status: 'FAILED', currency: null, fee: null, charged: null, netAmount: null };
    const view = await callerFor(db).payment({ id: 'con_1', paymentId, force: true });

    expect(view).toMatchObject({ status: 'FAILED', consultation: null, heldUntil: consultations[0]!.heldUntil });
    expect(consultations[0]!.status).toBe('HELD');
    expect(mail.appMailer.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Votre paiement n’est pas passé', text: expect.stringContaining('Rien n’a été débité') }));
  });

  it('stays PENDING without asking SasPay again within a few seconds', async () => {
    const { db } = fakeDatabase();
    const { paymentId } = await callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn });
    expect(await callerFor(db).payment({ id: 'con_1', paymentId })).toMatchObject({ status: 'PENDING' });
    expect(client.verify).not.toHaveBeenCalled();
  });
});

describe('Codes promo at checkout', () => {
  it('applies a live code to the booking, and the booking shows its reduction and the places left', async () => {
    const { db, consultations } = fakeDatabase({ codes: [BLACKFRIDAY], paid: paidWith('promo_bf', 13) });
    expect(await callerFor(db).applyPromo({ id: 'con_1', code: ' blackfriday ' })).toEqual({ code: 'BLACKFRIDAY' });
    expect(consultations[0]!.promoCodeId).toBe('promo_bf');

    const booking = await callerFor(db).booking({ id: 'con_1' });
    expect(booking.promo).toMatchObject({ code: 'BLACKFRIDAY', discount: 10_500, places: 20, placesLeft: 7 });
    expect(booking.amount).toBe(4_500);
  });

  it('suggests the code a typo meant', async () => {
    const { db } = fakeDatabase({ codes: [BLACKFRIDAY] });
    await expect(callerFor(db).applyPromo({ id: 'con_1', code: 'BLACKFRYDAY' })).rejects.toThrow('PROMO_UNKNOWN:BLACKFRIDAY');
  });

  it('refuses a code whose places are all paid, one that ended, and one this Compte already used', async () => {
    const soldOut = fakeDatabase({ codes: [{ ...BLACKFRIDAY, places: 13 }], paid: paidWith('promo_bf', 13) });
    await expect(callerFor(soldOut.db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' })).rejects.toThrow('PROMO_SOLD_OUT');

    const ended = fakeDatabase({ codes: [{ ...BLACKFRIDAY, endsAt: new Date('2026-11-23T07:00:00Z') }] });
    await expect(callerFor(ended.db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' })).rejects.toThrow('PROMO_ENDED');

    const used = fakeDatabase({ codes: [BLACKFRIDAY], paid: [{ id: 'mine', consultationId: 'con_before', accountId: 'acc_1', promoCodeId: 'promo_bf' }] });
    await expect(callerFor(used.db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' })).rejects.toThrow('PROMO_USED');
  });

  it('charges the price less the reduction, and keeps it on the payment', async () => {
    const { db, payments } = fakeDatabase({ codes: [BLACKFRIDAY] });
    await callerFor(db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' });
    await callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn });

    expect(client.softpay).toHaveBeenCalledWith(expect.objectContaining({ amount: 4_500 }), expect.any(String));
    expect(payments.at(-1)).toMatchObject({ amount: 4_500, discount: 10_500, promoCodeId: 'promo_bf' });
  });

  it('just before paying, counts places still on their way: the last one gone, nothing is sent and the full price is back', async () => {
    const { db, consultations } = fakeDatabase({ codes: [{ ...BLACKFRIDAY, places: 14 }], paid: paidWith('promo_bf', 13) });
    await callerFor(db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' });
    // Someone else is paying with the 14th place right now.
    const someoneElse = { id: 'other_pending', consultationId: 'con_other', accountId: 'acc_other', promoCodeId: 'promo_bf', status: 'PENDING', createdAt: new Date() };
    await (db as unknown as { consultationPayment: { create: (a: { data: Row }) => Promise<Row> } }).consultationPayment.create({ data: someoneElse });

    await expect(callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn })).rejects.toThrow('PROMO_LAST_PLACE');
    expect(client.softpay).not.toHaveBeenCalled();
    expect(consultations[0]!.promoCodeId).toBeNull();
  });

  it('a code deleted meanwhile simply ended: full price shown again before paying', async () => {
    const { db, consultations } = fakeDatabase({ codes: [BLACKFRIDAY] });
    await callerFor(db).applyPromo({ id: 'con_1', code: 'BLACKFRIDAY' });
    const code = (await db.promoCode.findUnique({ where: { id: 'promo_bf' } })) as unknown as Row;
    code.deletedAt = new Date();

    expect((await callerFor(db).booking({ id: 'con_1' })).promo).toBeNull();
    await expect(callerFor(db).pay({ id: 'con_1', locale: 'fr', method: mtn })).rejects.toThrow('PROMO_ENDED');
    expect(consultations[0]!.promoCodeId).toBeNull();
  });
});
