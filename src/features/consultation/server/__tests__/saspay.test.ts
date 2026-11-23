import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { feeFor } from '@/features/consultation/lib/payment-fees';
import { createSasPay, saspayConfig, SasPayError, webhookIsValid } from '@/features/consultation/server/saspay';

describe('saspayConfig', () => {
  it('calls the sandbox with a test key outside production', () => {
    expect(saspayConfig('sk_test_abc', false)).toEqual({ apiKey: 'sk_test_abc', baseUrl: 'https://sandbox-api.saspay.me/api/v1' });
  });

  it('refuses a live key outside production, so a laptop never charges real money', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(saspayConfig('sk_live_abc', false)).toBeNull();
  });

  it('calls the live API with a live key in production only, and refuses a test key there', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(saspayConfig('sk_live_abc', true)?.baseUrl).toBe('https://api.saspay.me/api/v1');
    expect(saspayConfig('sk_test_abc', true)).toBeNull();
    expect(saspayConfig(undefined, true)).toBeNull();
  });
});

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createSasPay', () => {
  const config = { apiKey: 'sk_test_key', baseUrl: 'https://sandbox-api.saspay.me/api/v1' };

  it('pushes a payment with decimal amounts, ADD_ON fees and the idempotency key', async () => {
    const fetcher = vi.fn(async () =>
      reply(201, { success: true, data: { id: 'tx_1', status: 'PENDING', checkout_url: '' }, code: 201 }),
    );
    const result = await createSasPay(config, fetcher as unknown as typeof fetch).softpay(
      {
        amount: 15000,
        currency: 'XAF',
        country: 'CM',
        network: 'mtn_cm',
        description: 'Consultation',
        customer: { email: 'a@example.com', firstName: 'Aminata', lastName: 'Diallo', phone: '+237677123450' },
        returnUrl: 'https://example.com/fr/services/consultation/reserver/paiement/p_1',
        metadata: { consultationId: 'con_1' },
      },
      'key-1',
    );

    expect(result).toEqual({ id: 'tx_1', status: 'PENDING', checkoutUrl: null });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sandbox-api.saspay.me/api/v1/payments/softpay/');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test_key', 'Idempotency-Key': 'key-1' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      amount: '15000.00',
      fee_charge_mode: 'ADD_ON',
      return_url: 'https://example.com/fr/services/consultation/reserver/paiement/p_1',
      customer: { first_name: 'Aminata' },
    });
  });

  it('turns a refusal into a SasPayError with its code', async () => {
    const fetcher = vi.fn(async () =>
      reply(422, { success: false, error: { message: 'Pas de route', code: 'no_route_available' }, code: 422 }),
    );
    const error = await createSasPay(config, fetcher as unknown as typeof fetch)
      .verify('tx_1')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SasPayError);
    expect(error).toMatchObject({ status: 422, code: 'no_route_available' });
  });

  it('reads verify’s amounts, and only pay-in networks from my-rates', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith('/verify/')
        ? reply(200, { success: true, data: { status: 'SUCCESS', currency: 'XAF', client_fee: '713.00', debited_amount: '15713.00', net_amount: '15000.00' } })
        : reply(200, {
            success: true,
            data: [
              {
                country_code: 'CI',
                country_name: 'Côte d’Ivoire',
                currency: 'XOF',
                network_code: 'orange_ci',
                network_name: 'Orange Money',
                payin: { available: true, otp_required: true, otp_instructions: '#144*82#', tiers: [{ min_amount: '0.00', max_amount: null, percent: '3.900', fixed: '0.00', floor_amount: null, cap_amount: null }] },
              },
              { country_code: 'CI', network_code: 'payout_only', payin: { available: false } },
            ],
          }),
    );
    const client = createSasPay(config, fetcher as unknown as typeof fetch);
    expect(await client.verify('tx_1')).toEqual({ status: 'SUCCESS', currency: 'XAF', fee: '713.00', charged: '15713.00', netAmount: '15000.00' });
    const networks = await client.networks();
    expect(networks).toHaveLength(1);
    expect(networks[0]).toMatchObject({ code: 'orange_ci', otpRequired: true, tiers: [{ percent: 3.9, maxAmount: null }] });
  });
});

describe('webhookIsValid', () => {
  const secret = 'whsec_test';
  const body = '{"event":"transaction.success","data":{"id":"tx_1"}}';
  const sign = (timestamp: string, raw = body) => createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');

  it('accepts SasPay’s signature on the raw body within 5 minutes', () => {
    expect(webhookIsValid(body, sign('1000'), '1000', secret, 1200)).toBe(true);
  });

  it('refuses an old event, a changed body or a wrong signature', () => {
    expect(webhookIsValid(body, sign('1000'), '1000', secret, 1301)).toBe(false);
    expect(webhookIsValid(`${body} `, sign('1000'), '1000', secret, 1000)).toBe(false);
    expect(webhookIsValid(body, 'nope', '1000', secret, 1000)).toBe(false);
    expect(webhookIsValid(body, null, '1000', secret, 1000)).toBe(false);
  });
});

describe('feeFor', () => {
  const tier = { minAmount: 0, maxAmount: 500_000, percent: 4.75, fixed: 0, floor: null, cap: null };

  it('applies the band’s percentage, rounded up to the franc', () => {
    expect(feeFor(4500, [tier])).toBe(214);
    expect(feeFor(15000, [tier])).toBe(713);
  });

  it('keeps the floor and the cap, and is unknown outside every band', () => {
    expect(feeFor(100, [{ ...tier, floor: 50 }])).toBe(50);
    expect(feeFor(1_000_000, [{ ...tier, maxAmount: null, cap: 5000 }])).toBe(5000);
    expect(feeFor(600_000, [tier])).toBeNull();
  });
});
