import { invoiceTotal } from '@/features/invoices/lib/money';
import type { InvoiceStatus } from '@/features/invoices/lib/invoice-status';

/** A Dossier's Facture as the balance counts it: Brouillons and Annulées don't. */
export type BalanceInvoice = {
  id: string;
  status: InvoiceStatus;
  lines: { quantity: number; unitAmount: number }[];
  payments: { amount: number }[];
};

export type ServiceBalance = {
  /** « Prix du service ». */
  price: number;
  /** Every sent Facture, not Annulée. */
  invoiced: number;
  /** Every Paiement on them. */
  paid: number;
  /** What the Client still owes on the service: price − paid, never below 0. */
  remaining: number;
  /** What is still to invoice: price − invoiced, never below 0. */
  toInvoice: number;
};

const counts = (invoice: BalanceInvoice): boolean => invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED';

/**
 * Where a Dossier's service stands against its « Prix du service » (#158).
 * Null without a price: no balance is shown rather than a wrong one.
 */
export function serviceBalance(price: number | null, invoices: BalanceInvoice[]): ServiceBalance | null {
  if (price === null) return null;
  const kept = invoices.filter(counts);
  const invoiced = kept.reduce((sum, invoice) => sum + invoiceTotal(invoice.lines), 0);
  const paid = kept.reduce((sum, invoice) => sum + invoice.payments.reduce((s, payment) => s + payment.amount, 0), 0);
  return {
    price,
    invoiced,
    paid,
    remaining: Math.max(0, price - paid),
    toInvoice: Math.max(0, price - invoiced),
  };
}

/**
 * What a Facture prints (#158): the service's price, what earlier Factures
 * already asked for, this one, and what is left after it. `invoice` is
 * counted even as a Brouillon being previewed.
 */
export function invoiceBalance(
  price: number | null,
  invoice: { id: string; lines: { quantity: number; unitAmount: number }[] },
  others: BalanceInvoice[],
): { price: number; earlier: number; thisInvoice: number; remaining: number } | null {
  if (price === null) return null;
  const earlier = others
    .filter((other) => other.id !== invoice.id && counts(other))
    .reduce((sum, other) => sum + invoiceTotal(other.lines), 0);
  const thisInvoice = invoiceTotal(invoice.lines);
  return { price, earlier, thisInvoice, remaining: Math.max(0, price - earlier - thisInvoice) };
}

/** One service sold on a Dossier (#158): its own service, or a « Stanzy s'en charge » request. */
export type PricedLine = { price: number | null; partnerPrice: number | null };

/**
 * A Dossier's totals over its services (#158): the price is the sum of the
 * prices set (null when none is), and so is what partners take.
 */
export function pricingTotals(lines: PricedLine[]): { price: number | null; partnerPrice: number } {
  const priced = lines.filter((line) => line.price !== null);
  return {
    price: priced.length === 0 ? null : priced.reduce((sum, line) => sum + line.price!, 0),
    partnerPrice: lines.reduce((sum, line) => sum + (line.partnerPrice ?? 0), 0),
  };
}

/** Bénéfice (#158) = what the Client pays − what the partners take − the Dossier's other Charges. */
export function serviceProfit(price: number | null, partnerPrice: number | null, charges: number): number | null {
  if (price === null) return null;
  return price - (partnerPrice ?? 0) - charges;
}
