import { randomUUID } from 'node:crypto';

import type { ConsultationPayment } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';

import { consultationFailedEmail, consultationPaidEmail } from '@/features/consultation/lib/consultation-emails';
import { HOLD_LIMIT_MINUTES, PAYING_MINUTES, PAYMENT_ERRORS, type PayInput } from '@/features/consultation/lib/payment';
import { feeFor } from '@/features/consultation/lib/payment-fees';
import { freeSlots, MINUTE } from '@/features/consultation/lib/slots';
import { BOOKING_LOCK, busyTimes, loadAvailability, overlapsBusy, type Db } from '@/features/consultation/server/booking-calendar';
import { SasPayError, type SasPay, type SasPayNetwork, type SasPayVerdict } from '@/features/consultation/server/saspay';
import { clientRoomPath, newInviteToken } from '@/features/meetings/lib/meeting-schema';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { appMailer } from '@/server/email/app-mailer';

/** FCFA: the price's currency, and the two currencies SasPay can take it in as is (1 XAF = 1 XOF). */
const FCFA = new Set(['XAF', 'XOF']);

/** How often a polling page may make us ask SasPay about one payment. */
const CHECK_EVERY_MS = 4000;

/** SasPay's networks change rarely; asked at most every 10 minutes. */
const NETWORKS_TTL_MS = 10 * 60 * 1000;
let networksCache: { at: number; value: SasPayNetwork[] } | null = null;

async function allNetworks(client: SasPay): Promise<SasPayNetwork[]> {
  if (networksCache && Date.now() - networksCache.at < NETWORKS_TTL_MS) return networksCache.value;
  const value = await client.networks();
  networksCache = { at: Date.now(), value };
  return value;
}

/** Test seam: forget the networks asked of SasPay. */
export const forgetNetworks = () => {
  networksCache = null;
};

export type PaymentOption = {
  code: string;
  name: string;
  otpRequired: boolean;
  otpInstructions: string;
  /** SasPay's fee on the price, or null when it can only be known on SasPay's page. */
  fee: number | null;
};

/**
 * Step 3's choices for `country`: its networks with their fee on the price,
 * and every country one can pay from (« Payer depuis un autre pays »). No
 * network: card on SasPay's page (`3b`). Never a hard-coded list.
 */
export async function paymentOptions(client: SasPay, country: string, price: number) {
  const networks = await allNetworks(client);
  const countries = new Map<string, string>();
  for (const n of networks) countries.set(n.country, n.countryName);
  return {
    countries: [...countries].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
    networks: networks
      .filter((n) => n.country === country)
      .map(
        (n): PaymentOption => ({
          code: n.code,
          name: n.name,
          otpRequired: n.otpRequired,
          otpInstructions: n.otpInstructions,
          fee: FCFA.has(n.currency) ? feeFor(price, n.tiers) : null,
        }),
      ),
  };
}

type Booking = {
  id: string;
  accountId: string;
  status: string;
  createdAt: Date;
  heldUntil: Date | null;
  phone: string;
  account: { name: string; email: string };
};

const splitName = (name: string) => {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') || first };
};

/**
 * « Payer »: starts one SasPay payment for a held booking. The attempt is
 * written first with its `Idempotency-Key`, so a network retry never charges
 * twice; a refusal SasPay gives at once is kept as FAILED. Paying keeps the
 * slot a little longer (never past HOLD_LIMIT_MINUTES after it was held).
 * The answer says where the payer goes: wait for their phone, or SasPay's page.
 */
export async function startPayment(prisma: Db, client: SasPay, booking: Booking, input: PayInput, price: number) {
  const now = new Date();
  const { method } = input;
  let network: SasPayNetwork | undefined;
  if (method.kind === 'network') {
    network = (await allNetworks(client)).find((n) => n.country === method.country && n.code === method.network);
    if (!network) throw new TRPCError({ code: 'BAD_REQUEST', message: PAYMENT_ERRORS.network });
    if (network.otpRequired && !method.otp) throw new TRPCError({ code: 'BAD_REQUEST', message: PAYMENT_ERRORS.otp });
  }
  const currency = network && FCFA.has(network.currency) ? network.currency : 'XAF';
  const id = randomUUID();
  const idempotencyKey = randomUUID();
  const description = 'Consultation Stanzy Immigration';
  const metadata = { consultationId: booking.id, paymentId: id };

  await prisma.consultationPayment.create({
    data: {
      id,
      consultationId: booking.id,
      flow: method.kind === 'network' ? 'SOFTPAY' : 'CHECKOUT',
      idempotencyKey,
      country: method.country,
      network: network?.code ?? null,
      networkName: network?.name ?? null,
      phone: method.kind === 'network' ? method.phone : null,
      amount: price,
      currency,
    },
  });

  try {
    let started: { transactionId: string | null; checkoutId: string | null; checkoutUrl: string | null };
    if (method.kind === 'network') {
      const push = () =>
        client.softpay(
          {
            amount: price,
            currency,
            country: method.country,
            network: method.network,
            description,
            customer: { email: booking.account.email, ...splitName(booking.account.name), phone: method.phone },
            otp: method.otp,
            metadata,
          },
          idempotencyKey,
        );
      // A timeout proves nothing: ask again with the same key, SasPay answers the first call's result.
      const result = await push().catch((error: unknown) => {
        if (error instanceof SasPayError && error.status < 500) throw error;
        return push();
      });
      started = { transactionId: result.id, checkoutId: null, checkoutUrl: result.checkoutUrl };
    } else {
      const session = await client.checkout({
        amount: price,
        currency,
        country: method.country,
        description,
        customer: { email: booking.account.email, name: booking.account.name, phone: booking.phone },
        returnUrl: `${siteUrl()}/${input.locale}/services/consultation/reserver/paiement/${id}`,
        expiresAt: new Date(now.getTime() + HOLD_LIMIT_MINUTES * MINUTE),
        metadata,
      });
      started = { transactionId: null, checkoutId: session.id, checkoutUrl: session.checkoutUrl };
    }

    const limit = new Date(booking.createdAt.getTime() + HOLD_LIMIT_MINUTES * MINUTE);
    const paying = new Date(Math.min(now.getTime() + PAYING_MINUTES * MINUTE, limit.getTime()));
    await prisma.$transaction([
      prisma.consultationPayment.update({ where: { id }, data: { ...started, checkedAt: now } }),
      prisma.consultation.updateMany({
        where: { id: booking.id, status: 'HELD', heldUntil: { lt: paying } },
        data: { heldUntil: paying },
      }),
    ]);
    return { paymentId: id, checkoutUrl: started.checkoutUrl };
  } catch (error) {
    const code = error instanceof SasPayError ? (error.code ?? `http_${error.status}`) : 'unreachable';
    await prisma.consultationPayment.update({ where: { id }, data: { status: 'FAILED', failureCode: code, settledAt: now } });
    console.error('[saspay] payment not started', booking.id, code, error instanceof Error ? error.message : error);
    const message = code === 'prepayment_otp_missing' ? PAYMENT_ERRORS.otp : PAYMENT_ERRORS.refused;
    throw new TRPCError({ code: 'BAD_REQUEST', message });
  }
}

/**
 * Asks SasPay where a PENDING payment stands and acts on it: `SUCCESS`
 * delivers, `FAILED` tells the payer. A recent check is not repeated unless
 * `force` (« Vérifier maintenant », the webhook). Returns the payment as it now is.
 */
export async function refreshPayment(prisma: Db, client: SasPay, payment: ConsultationPayment, force = false): Promise<ConsultationPayment> {
  if (payment.status !== 'PENDING') return payment;
  const now = new Date();
  if (!force && payment.checkedAt && now.getTime() - payment.checkedAt.getTime() < CHECK_EVERY_MS) return payment;

  let transactionId = payment.transactionId;
  try {
    if (!transactionId && payment.checkoutId) {
      transactionId = await client.checkoutTransaction(payment.checkoutId);
      if (transactionId) await prisma.consultationPayment.update({ where: { id: payment.id }, data: { transactionId } });
    }
    if (!transactionId) {
      return prisma.consultationPayment.update({ where: { id: payment.id }, data: { checkedAt: now } });
    }
    const verdict = await client.verify(transactionId);
    await settlePayment(prisma, payment.id, verdict);
  } catch (error) {
    // SasPay unreachable or slow: the payment stays PENDING and is asked again later.
    console.warn('[saspay] could not check payment', payment.id, error instanceof Error ? error.message : error);
    await prisma.consultationPayment.update({ where: { id: payment.id }, data: { checkedAt: now } });
  }
  return prisma.consultationPayment.findUniqueOrThrow({ where: { id: payment.id } });
}

/** Acts on what SasPay verified for a payment. Safe to call twice: each outcome happens once. */
export async function settlePayment(prisma: Db, paymentId: string, verdict: SasPayVerdict): Promise<void> {
  if (verdict.status === 'SUCCESS') return deliver(prisma, paymentId, verdict);
  const now = new Date();
  if (verdict.status === 'PENDING') {
    await prisma.consultationPayment.update({ where: { id: paymentId }, data: { checkedAt: now } });
    return;
  }
  const { count } = await prisma.consultationPayment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: { status: 'FAILED', checkedAt: now, settledAt: now },
  });
  if (count === 0) return;
  const payment = await prisma.consultationPayment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { consultation: { include: { account: { select: { name: true, email: true, locale: true } } } } },
  });
  const { consultation } = payment;
  if (consultation.status !== 'HELD') return;
  const lang = toLocale(consultation.account.locale);
  mailLater(
    consultationFailedEmail({
      to: consultation.account.email,
      name: consultation.account.name,
      locale: lang,
      startsAt: consultation.startsAt,
      heldUntil: consultation.heldUntil,
      network: payment.networkName,
      url: `${siteUrl()}/${lang}/services/consultation/reserver`,
    }),
  );
}

/**
 * `SUCCESS`, in one transaction (docs/design/consultation.md, Lifecycle):
 * the attempt is marked paid with SasPay's amounts, the Consultation PAID
 * with its Réunion (the Client invited, recorded), and a plain User becomes a
 * Lead. Once only: a second call, or a second payment of the same booking,
 * changes nothing (the latter is logged for the consultant). If the slot was
 * taken while the payment was on its way, the Consultation goes to the next
 * free slot and the e-mail says so; it is never lost.
 */
async function deliver(prisma: Db, paymentId: string, verdict: SasPayVerdict): Promise<void> {
  const now = new Date();
  const decimal = (value: string | null) => (value === null ? undefined : value);
  const done = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK})`;
    const payment = await tx.consultationPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { consultation: { include: { account: { select: { id: true, name: true, email: true, locale: true } } } } },
    });
    if (payment.status === 'SUCCESS') return null;
    await tx.consultationPayment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCESS',
        fee: decimal(verdict.fee),
        charged: decimal(verdict.charged),
        netAmount: decimal(verdict.netAmount),
        checkedAt: now,
        settledAt: now,
      },
    });
    const consultation = payment.consultation;
    if (consultation.status !== 'HELD') {
      console.error('[saspay] a second payment succeeded for an already paid Consultation', consultation.id, paymentId);
      return null;
    }

    const db = tx as unknown as Db;
    const { availability } = await loadAvailability(db);
    const busy = await busyTimes(db, now, availability.horizonDays, consultation.accountId);
    let startsAt = consultation.startsAt;
    let moved = false;
    if (overlapsBusy(busy, startsAt, consultation.durationMinutes)) {
      const next = freeSlots(availability, busy, now)[0]?.starts[0];
      if (next) {
        startsAt = new Date(next);
        moved = true;
      } else {
        console.error('[saspay] paid slot taken and no free slot left; kept as is for the consultant', consultation.id);
      }
    }

    const consultant = await tx.account.findFirst({ where: { role: 'CONSULTANT' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    const meeting = await tx.meeting.create({
      data: {
        subject: `Consultation · ${consultation.account.name}`,
        startsAt,
        durationMinutes: consultation.durationMinutes,
        recording: true,
        inviteToken: newInviteToken(),
        plannedById: consultant?.id ?? consultation.accountId,
        participants: { create: [{ accountId: consultation.accountId }] },
      },
      select: { id: true },
    });
    await tx.consultation.update({
      where: { id: consultation.id },
      data: { status: 'PAID', paidAt: now, paidById: paymentId, meetingId: meeting.id, heldUntil: null, startsAt },
    });
    await tx.account.updateMany({ where: { id: consultation.accountId, status: 'USER' }, data: { status: 'LEAD' } });
    return { account: consultation.account, startsAt, moved, meetingId: meeting.id, durationMinutes: consultation.durationMinutes, payment };
  });
  if (!done) return;

  const lang = toLocale(done.account.locale);
  mailLater(
    consultationPaidEmail({
      to: done.account.email,
      name: done.account.name,
      locale: lang,
      startsAt: done.startsAt,
      durationMinutes: done.durationMinutes,
      paid: verdict.charged ? Math.round(Number(verdict.charged)) : done.payment.amount,
      network: done.payment.networkName,
      moved: done.moved,
      url: `${siteUrl()}/${lang}${clientRoomPath(done.meetingId)}`,
    }),
  );
}

/** Sends after the response; a failure is logged, never thrown (the payment is already recorded). */
function mailLater(message: Parameters<typeof appMailer.send>[0]): void {
  const send = async () => {
    try {
      await appMailer.send(message);
    } catch (error) {
      console.error('[consultation] could not send', message.subject, error);
    }
  };
  try {
    after(send);
  } catch {
    // Outside a request (a script, a test): send now.
    void send();
  }
}
