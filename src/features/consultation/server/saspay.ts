import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FeeTier } from '@/features/consultation/lib/payment-fees';
import { env } from '@/lib/env';

/**
 * SasPay (#15), the only way the Consultation is paid. Its OpenAPI spec is the
 * source of truth (https://docs.saspay.me/api-reference/openapi.json); the
 * `saspay-integration` skill holds the rules. Server only: the key never
 * reaches the browser, a log or a response.
 *
 * Sandbox or live is decided by the base URL, not the key's prefix. So
 * everywhere but Vercel production this calls the sandbox, and an `sk_live_`
 * key there is refused rather than charging real money from a laptop.
 */
const LIVE = 'https://api.saspay.me/api/v1';
const SANDBOX = 'https://sandbox-api.saspay.me/api/v1';

export type SasPayStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/** A network one can pay in with, in one country. */
export type SasPayNetwork = {
  country: string;
  countryName: string;
  currency: string;
  code: string;
  name: string;
  /** Orange Money CI and BF: a code the payer gets by USSD before paying (`3c`). */
  otpRequired: boolean;
  otpInstructions: string;
  tiers: FeeTier[];
};

/** What verify tells: the status and, once paid, the amounts to account with. */
export type SasPayVerdict = {
  status: SasPayStatus;
  fee: string | null;
  charged: string | null;
  netAmount: string | null;
};

/** A refusal from SasPay: its HTTP status and stable error code when it has one. */
export class SasPayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'SasPayError';
  }
}

export type SasPayConfig = { apiKey: string; baseUrl: string };

/**
 * Which SasPay to call, or null when payment is not open here: no key, or a
 * key that doesn't match the place (a live key outside production, a test key
 * in production).
 */
export function saspayConfig(
  apiKey = env.SASPAY_API_KEY,
  production = process.env.VERCEL_ENV === 'production',
): SasPayConfig | null {
  if (!apiKey) return null;
  const live = apiKey.startsWith('sk_live_');
  if (live !== production) {
    console.error(
      production
        ? '[saspay] SASPAY_API_KEY is a sandbox key in production: payment is closed'
        : '[saspay] SASPAY_API_KEY is a live key outside production: refused, use an sk_test_ sandbox key',
    );
    return null;
  }
  return { apiKey, baseUrl: production ? LIVE : SANDBOX };
}

type Json = Record<string, unknown>;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number | null => (value === null || value === undefined || value === '' ? null : Number(value));
const status = (value: unknown): SasPayStatus => (value === 'SUCCESS' ? 'SUCCESS' : value === 'PENDING' ? 'PENDING' : 'FAILED');

/** A SasPay client over `fetch`: one per call site, cheap to make. */
export function createSasPay(config: SasPayConfig, fetchImpl: typeof fetch = fetch) {
  async function call(method: 'GET' | 'POST', path: string, body?: Json, idempotencyKey?: string): Promise<unknown> {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as Json | null;
    if (!response.ok || payload?.success === false) {
      const error = (payload?.error ?? {}) as Json;
      throw new SasPayError(
        response.status,
        typeof error.code === 'string' ? error.code : null,
        typeof error.message === 'string' ? error.message : `SasPay ${method} ${path} answered ${response.status}`,
      );
    }
    // Answers come wrapped as { success, data, code }; take `data` when it is there.
    return payload && 'data' in payload ? payload.data : payload;
  }

  return {
    /** Every network one can pay in with, all countries (`GET /pricing/my-rates/`). */
    async networks(): Promise<SasPayNetwork[]> {
      const rows = (await call('GET', '/pricing/my-rates/')) as Json[];
      return (Array.isArray(rows) ? rows : [])
        .filter((row) => (row.payin as Json | undefined)?.available === true)
        .map((row) => {
          const payin = row.payin as Json;
          return {
            country: str(row.country_code),
            countryName: str(row.country_name),
            currency: str(row.currency),
            code: str(row.network_code),
            name: str(row.network_name),
            otpRequired: payin.otp_required === true,
            otpInstructions: str(payin.otp_instructions),
            tiers: ((payin.tiers as Json[] | undefined) ?? []).map((tier) => ({
              minAmount: num(tier.min_amount) ?? 0,
              maxAmount: num(tier.max_amount),
              percent: num(tier.percent) ?? 0,
              fixed: num(tier.fixed) ?? 0,
              floor: num(tier.floor_amount),
              cap: num(tier.cap_amount),
            })),
          };
        });
    },

    /** Pushes the payment to the payer's phone; a non-empty `checkoutUrl` must be opened instead. */
    async softpay(
      input: {
        amount: number;
        currency: string;
        country: string;
        network: string;
        description: string;
        customer: { email: string; firstName: string; lastName: string; phone: string };
        otp?: string;
        metadata: Json;
      },
      idempotencyKey: string,
    ): Promise<{ id: string; status: SasPayStatus; checkoutUrl: string | null }> {
      const data = (await call(
        'POST',
        '/payments/softpay/',
        {
          amount: input.amount.toFixed(2),
          currency: input.currency,
          country: input.country,
          network: input.network,
          description: input.description,
          fee_charge_mode: 'ADD_ON',
          customer: {
            email: input.customer.email,
            first_name: input.customer.firstName,
            last_name: input.customer.lastName,
            phone: input.customer.phone,
          },
          metadata: input.metadata,
          ...(input.otp ? { otp: input.otp } : {}),
        },
        idempotencyKey,
      )) as Json;
      return { id: str(data.id), status: status(data.status), checkoutUrl: str(data.checkout_url) || null };
    },

    /** SasPay's hosted page, where the payer chooses (card, another country). No idempotency there. */
    async checkout(input: {
      amount: number;
      currency: string;
      country: string;
      description: string;
      customer: { email: string; name: string; phone: string };
      returnUrl: string;
      expiresAt: Date;
      metadata: Json;
    }): Promise<{ id: string; checkoutUrl: string }> {
      const data = (await call('POST', '/checkout-sessions/', {
        amount: input.amount.toFixed(2),
        currency: input.currency,
        country: input.country,
        description: input.description,
        customer_email: input.customer.email,
        customer_name: input.customer.name,
        customer_phone: input.customer.phone,
        return_url: input.returnUrl,
        expires_at: input.expiresAt.toISOString(),
        fee_charge_mode: 'ADD_ON',
        metadata: input.metadata,
      })) as Json;
      return { id: str(data.id), checkoutUrl: str(data.checkout_url) };
    },

    /** The real status, asked of the gateway each time (`GET /payments/{id}/verify/`). */
    async verify(transactionId: string): Promise<SasPayVerdict> {
      const data = (await call('GET', `/payments/${encodeURIComponent(transactionId)}/verify/`)) as Json;
      return {
        status: status(data.status),
        fee: str(data.client_fee) || null,
        charged: str(data.debited_amount) || null,
        netAmount: str(data.net_amount) || null,
      };
    },

    /** A hosted page's transaction, once the payer has paid on it. */
    async checkoutTransaction(checkoutId: string): Promise<string | null> {
      const data = (await call('GET', `/checkout-sessions/${encodeURIComponent(checkoutId)}/status/`)) as Json;
      return str(data.transaction_id) || null;
    },
  };
}

export type SasPay = ReturnType<typeof createSasPay>;

/** The client for this deployment, or null when payment is not open here. */
export function saspay(): SasPay | null {
  const config = saspayConfig();
  return config ? createSasPay(config) : null;
}

/** Webhooks older than this are refused: a captured one can't be replayed. */
const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Whether a webhook is SasPay's: its timestamp within 5 minutes, and its
 * signature the HMAC-SHA256 of `${timestamp}.${rawBody}` with the signing
 * secret, compared in constant time. Always on the raw body, never re-serialised.
 */
export function webhookIsValid(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
