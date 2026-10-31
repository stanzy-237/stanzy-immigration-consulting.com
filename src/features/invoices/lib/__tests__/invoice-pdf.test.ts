import { readFileSync } from 'node:fs';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { renderInvoicePdf, wrap, type InvoicePdfData } from '@/features/invoices/lib/invoice-pdf';

const letterhead = readFileSync('src/features/invoices/assets/letterhead.pdf');

const data = (lines: InvoicePdfData['lines']): InvoicePdfData => ({
  locale: 'fr',
  number: 'STZ-2026-0001',
  issuedOn: new Date('2026-10-31T10:00:00Z'),
  dueDate: new Date('2026-11-15T00:00:00Z'),
  currency: 'XAF',
  client: { name: 'Aminata Diallo', email: 'aminata@example.com' },
  service: 'Accompagnement Entrée Express',
  lines,
  notes: 'Paiement par Orange Money ✅\nMerci.',
  stamp: 'PAID',
  labels: {
    title: 'Facture',
    number: 'N°',
    issuedOn: 'Date d’émission',
    dueDate: 'Échéance',
    billedTo: 'Facturé à',
    dossier: 'Dossier',
    description: 'Description',
    quantity: 'Qté',
    unitPrice: 'Prix unitaire',
    amount: 'Montant',
    total: 'Total',
    notes: 'Notes',
    page: (page, pages) => `Page ${page}/${pages}`,
    paid: 'Payée',
    cancelled: 'Annulée',
  },
});

const line = { description: 'Traduction certifiée', quantity: 2, unitAmount: 12500 };

describe('the Facture PDF', () => {
  it('is drawn on the A4 letterhead, its title set, characters the font lacks dropped', async () => {
    const pdf = await PDFDocument.load(await renderInvoicePdf(letterhead, data([line])));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
    expect(pdf.getTitle()).toBe('Facture STZ-2026-0001');
  });

  it('continues on another letterhead page when the lines don’t fit', async () => {
    const pdf = await PDFDocument.load(
      await renderInvoicePdf(letterhead, data(Array.from({ length: 30 }, () => line))),
    );
    expect(pdf.getPageCount()).toBe(2);
  });

  it('wraps a long description and keeps the notes’ line breaks', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const rows = wrap('un deux trois quatre cinq six sept huit neuf dix', font, 10, 80);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.join(' ')).toBe('un deux trois quatre cinq six sept huit neuf dix');
    expect(wrap('Ligne une\nLigne deux', font, 10, 400)).toEqual(['Ligne une', 'Ligne deux']);
  });
});
