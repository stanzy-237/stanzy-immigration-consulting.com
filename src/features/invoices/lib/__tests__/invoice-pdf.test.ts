import { readFileSync } from 'node:fs';

import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { jpegOf } from '@/features/pdf-tools/lib/__tests__/fixtures';
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
  consultant: null,
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
    company: 'Stanzy Immigration Consulting',
  },
});

const line = { description: 'Traduction certifiée', quantity: 2, unitAmount: 12500 };

/** How many images a PDF holds. */
async function imagesIn(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
    .length;
}

describe('the Facture PDF', () => {
  it('carries the consultant’s signature and the stamp once Payée, not before', async () => {
    const consultant = {
      signature: { bytes: jpegOf(60, 20), type: 'image/jpeg' as const },
      stamp: { bytes: jpegOf(40, 40), type: 'image/jpeg' as const },
    };
    const bare = await imagesIn(await renderInvoicePdf(letterhead, data([line])));
    expect(await imagesIn(await renderInvoicePdf(letterhead, { ...data([line]), consultant }))).toBe(bare + 2);
    const sent = { ...data([line]), stamp: null, consultant };
    expect(await imagesIn(await renderInvoicePdf(letterhead, sent))).toBe(bare);
  });

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
