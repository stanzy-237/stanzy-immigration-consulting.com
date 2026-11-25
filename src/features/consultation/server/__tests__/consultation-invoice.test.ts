import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import { consultationInvoice } from '@/features/consultation/server/consultation-invoice';
import type { InvoicePdfData } from '@/features/invoices/lib/invoice-pdf';
import type { TRPCContext } from '@/server/trpc/context';

/** Seam: what the letterhead is drawn with, watched; the consultant's signature not set up. */
const drawn = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/features/invoices/lib/invoice-pdf', async (original) => {
  const real = await original<typeof import('@/features/invoices/lib/invoice-pdf')>();
  return {
    ...real,
    renderInvoicePdf: async (letterhead: Uint8Array, data: InvoicePdfData) => {
      drawn.data = data;
      return real.renderInvoicePdf(letterhead, data);
    },
  };
});
vi.mock('@/features/signatures/server/signing-assets', () => ({ openSigningAssets: async () => null }));

const PAID = {
  id: '0b8f6a3e-4b5d-4c1e-9a2f-5d6e7f8a9b0c',
  status: 'SUCCESS',
  invoiceNumber: 'STZ-2026-0007',
  amount: 4_500,
  discount: 10_500,
  currency: 'XAF',
  settledCurrency: 'XAF',
  fee: '214.00',
  charged: '4714.00',
  network: 'mtn_cm',
  networkName: 'MTN Mobile Money',
  phone: '+237677123450',
  settledAt: new Date('2026-11-24T08:42:00Z'),
  updatedAt: new Date('2026-11-24T08:42:00Z'),
  promoCode: { code: 'BLACKFRIDAY' },
  consultation: {
    startsAt: new Date('2026-11-25T08:00:00Z'),
    durationMinutes: 45,
    account: { name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' },
  },
};
const db = (payment: unknown) => ({ consultationPayment: { findUnique: async () => payment } }) as unknown as TRPCContext['prisma'];

describe('consultationInvoice', () => {
  it('draws the Facture payée: stamped, the Consultation and the code’s reduction, how it was paid', async () => {
    const invoice = await consultationInvoice(db(PAID), PAID.id);

    expect(invoice?.number).toBe('STZ-2026-0007');
    const pdf = await PDFDocument.load(invoice!.pdf);
    expect(pdf.getTitle()).toBe('Facture STZ-2026-0007');
    expect(drawn.data).toMatchObject({
      stamp: 'PAID',
      client: { name: 'Aminata Diallo' },
      lines: [
        { description: expect.stringContaining('Consultation vidéo avec Stanzy · 45 min'), unitAmount: 15_000 },
        { description: 'Code promo BLACKFRIDAY', unitAmount: -10_500 },
      ],
      notes: expect.stringContaining('MTN Mobile Money · +237677123450'),
    });
    expect((drawn.data as InvoicePdfData).notes).toMatch(/dont 214 FCFA de frais SasPay/);
  });

  it('is nothing before SasPay said SUCCESS', async () => {
    expect(await consultationInvoice(db({ ...PAID, status: 'PENDING', invoiceNumber: null }), PAID.id)).toBeNull();
    expect(await consultationInvoice(db(null), PAID.id)).toBeNull();
  });
});
