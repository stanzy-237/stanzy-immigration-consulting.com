import { describe, expect, it } from 'vitest';

import { invoiceSentEmail, proofReceivedEmail } from '@/features/invoices/lib/invoice-emails';

const invoice = {
  number: 'STZ-2026-0001',
  total: 187500,
  currency: 'XAF' as const,
  dueDate: new Date('2026-11-15T00:00:00Z'),
  service: 'ACCOMPAGNEMENT' as const,
};

describe('Facture emails', () => {
  it('sends the PDF with the amount and the due date', () => {
    const email = invoiceSentEmail({
      to: 'aminata@example.com',
      name: 'Aminata',
      locale: 'fr',
      invoice,
      pdf: Buffer.from('%PDF'),
      url: 'https://stanzy.test/fr/mon-espace/dossiers/dos_1',
    });
    expect(email.subject).toBe('Facture STZ-2026-0001 – Stanzy Immigration Consulting');
    expect(email.text).toContain('187 500 FCFA, à régler avant le 15 novembre 2026');
    expect(email.attachments).toEqual([{ filename: 'STZ-2026-0001.pdf', content: Buffer.from('%PDF') }]);
  });

  it('tells the consultant which Client sent a proof, in English if that’s their language', () => {
    const email = proofReceivedEmail({
      to: 'stanzy@example.com',
      locale: 'en',
      client: 'Aminata Diallo',
      invoice: { ...invoice, currency: 'CAD', total: 125050 },
      url: 'https://admin.stanzy.test/factures/inv_1',
    });
    expect(email.subject).toBe('Aminata Diallo sent a proof of payment (STZ-2026-0001)');
    expect(email.text).toContain('CA$1,250.50');
  });
});
