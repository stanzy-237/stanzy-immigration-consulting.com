import { describe, expect, it } from 'vitest';

import { invoiceBalance, serviceBalance, serviceProfit, type BalanceInvoice } from '@/features/invoices/lib/service-balance';

const invoice = (id: string, status: BalanceInvoice['status'], total: number, paid: number[] = []): BalanceInvoice => ({
  id,
  status,
  lines: [{ quantity: 1, unitAmount: total }],
  payments: paid.map((amount) => ({ amount })),
});

describe('serviceBalance (#158)', () => {
  it('shows nothing without a Prix du service', () => {
    expect(serviceBalance(null, [invoice('a', 'SENT', 80)])).toBeNull();
  });

  it('counts sent Factures and their Paiements, not Brouillons nor Annulées', () => {
    const balance = serviceBalance(100, [
      invoice('a', 'PARTIALLY_PAID', 80, [50]),
      invoice('b', 'DRAFT', 20),
      invoice('c', 'CANCELLED', 40, []),
    ]);
    expect(balance).toEqual({ price: 100, invoiced: 80, paid: 50, remaining: 50, toInvoice: 20 });
  });

  it('never goes below zero', () => {
    expect(serviceBalance(100, [invoice('a', 'PAID', 120, [120])])).toMatchObject({ remaining: 0, toInvoice: 0 });
  });
});

describe('invoiceBalance (#158)', () => {
  it('leaves the rest of the price after this Facture', () => {
    expect(invoiceBalance(100, invoice('a', 'SENT', 80), [invoice('a', 'SENT', 80)])).toEqual({
      price: 100,
      earlier: 0,
      thisInvoice: 80,
      remaining: 20,
    });
  });

  it('takes earlier Factures off, even while this one is a Brouillon', () => {
    expect(invoiceBalance(100, invoice('b', 'DRAFT', 15), [invoice('a', 'PAID', 80, [80]), invoice('b', 'DRAFT', 15)])).toEqual({
      price: 100,
      earlier: 80,
      thisInvoice: 15,
      remaining: 5,
    });
  });
});

describe('serviceProfit (#158)', () => {
  it('is the price less the partner’s share and the Charges', () => {
    expect(serviceProfit(100, 30, 10)).toBe(60);
    expect(serviceProfit(100, null, 0)).toBe(100);
    expect(serviceProfit(null, 30, 0)).toBeNull();
  });
});
