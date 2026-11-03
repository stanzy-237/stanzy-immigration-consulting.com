import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { jpegOf } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { fieldPlacement, fingerprintOf, pageCountOf, signPdf, type SignPdfData } from '@/features/signatures/lib/sign-pdf';
import { createRequestInput, signedFileName } from '@/features/signatures/lib/signature-schema';

/** A 1 × 1 transparent PNG, as the signature pad would send. */
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

async function letterOf(pages: number, rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let n = 0; n < pages; n++) doc.addPage([600, 800]).setRotation(degrees(rotate));
  return doc.save();
}

const data = (overrides: Partial<SignPdfData> = {}): SignPdfData => ({
  fields: [
    { kind: 'SIGNATURE', page: 0, x: 0.1, y: 0.8, width: 0.3, height: 0.07 },
    { kind: 'NAME', page: 0, x: 0.1, y: 0.9, width: 0.3, height: 0.03 },
    { kind: 'DATE', page: 1, x: 0.6, y: 0.9, width: 0.2, height: 0.03 },
  ],
  signature: PNG,
  name: 'Aminata Diallo',
  date: '4 novembre 2026',
  consultant: null,
  certificate: {
    title: 'Certificat de signature',
    rows: [
      ['Signé par', 'Aminata Diallo'],
      ['Empreinte SHA-256', 'a'.repeat(64)],
    ],
    note: 'Ce certificat fait partie du document signé.',
  },
  letterhead: null,
  ...overrides,
});

describe('signPdf', () => {
  it('fills the fields and adds the Certificat de signature as the last page', async () => {
    const signed = await signPdf(await letterOf(2), data());
    const doc = await PDFDocument.load(signed);
    expect(doc.getPageCount()).toBe(3);
    // The original pages keep their size; the Certificat is A4.
    expect(doc.getPage(0).getSize()).toEqual({ width: 600, height: 800 });
    expect(doc.getPage(2).getWidth()).toBeCloseTo(595.28);
  });

  it('prints the Certificat on the letterhead when given', async () => {
    const letterhead = await PDFDocument.create();
    letterhead.addPage([500, 700]);
    const signed = await signPdf(await letterOf(1), data({ fields: [data().fields[0]!], letterhead: await letterhead.save() }));
    expect((await PDFDocument.load(signed)).getPage(1).getSize()).toEqual({ width: 500, height: 700 });
  });

  it('refuses a field on a page the PDF does not have', async () => {
    await expect(
      signPdf(await letterOf(1), data({ fields: [{ kind: 'SIGNATURE', page: 3, x: 0, y: 0, width: 0.2, height: 0.1 }] })),
    ).rejects.toThrow('SIGNATURE_FIELD_OUTSIDE');
  });

  it('needs the signature and the stamp for a STAMP field', async () => {
    const stampField = { kind: 'STAMP' as const, page: 0, x: 0.5, y: 0.8, width: 0.36, height: 0.12 };
    await expect(signPdf(await letterOf(1), data({ fields: [stampField] }))).rejects.toThrow(
      'SIGNATURE_ASSETS_MISSING',
    );
    const jpeg = { bytes: jpegOf(40, 20), type: 'image/jpeg' as const };
    const signed = await signPdf(
      await letterOf(1),
      data({ fields: [stampField], consultant: { signature: { bytes: PNG, type: 'image/png' }, stamp: jpeg } }),
    );
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);
  });

  it('signs a page shown turned', async () => {
    const signed = await signPdf(await letterOf(1, 90), data({ fields: [data().fields[0]!] }));
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);
  });
});

describe('fieldPlacement', () => {
  const crop = { x: 0, y: 0, width: 600, height: 800 };
  const field = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };

  it('measures from the top left of an upright page', () => {
    const placed = fieldPlacement(crop, 0, field);
    expect(placed.angle).toBe(0);
    expect(placed.origin.x).toBeCloseTo(60);
    // Its bottom edge: 30 % down the page, 70 % up from the bottom.
    expect(placed.origin.y).toBeCloseTo(560);
    expect(placed.width).toBeCloseTo(300);
    expect(placed.height).toBeCloseTo(80);
  });

  it('turns with a page rotated a quarter turn', () => {
    // Shown 800 wide and 600 high: the field is 400 × 60 as shown.
    const placed = fieldPlacement(crop, 90, field);
    expect(placed.angle).toBe(90);
    expect(placed.width).toBeCloseTo(400);
    expect(placed.height).toBeCloseTo(60);
    // Shown (0.1, 0.3) lands at x = 0.3 × 600, y = 0.1 × 800.
    expect(placed.origin).toEqual({ x: expect.closeTo(180), y: expect.closeTo(80) });
  });

  it('handles upside-down and three-quarter turns', () => {
    expect(fieldPlacement(crop, 180, field).origin).toEqual({ x: expect.closeTo(540), y: expect.closeTo(240) });
    expect(fieldPlacement(crop, -90, field).origin).toEqual({ x: expect.closeTo(420), y: expect.closeTo(720) });
  });

  it('counts from the crop box', () => {
    expect(fieldPlacement({ ...crop, x: 10, y: 20 }, 0, field).origin).toEqual({
      x: expect.closeTo(70),
      y: expect.closeTo(580),
    });
  });
});

describe('the PDF checks', () => {
  it('counts the pages of a readable PDF and refuses anything else', async () => {
    expect(await pageCountOf(await letterOf(3))).toBe(3);
    expect(await pageCountOf(new TextEncoder().encode('not a pdf'))).toBeNull();
  });

  it('fingerprints the exact bytes', async () => {
    const hash = await fingerprintOf(new TextEncoder().encode('abc'));
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('the request input', () => {
  const signature = { kind: 'SIGNATURE' as const, page: 0, x: 0.1, y: 0.1, width: 0.3, height: 0.07 };

  it('needs at least one Signature field', () => {
    expect(createRequestInput.safeParse({ versionId: 'v', fields: [signature] }).success).toBe(true);
    expect(
      createRequestInput.safeParse({ versionId: 'v', fields: [{ ...signature, kind: 'NAME' }] }).success,
    ).toBe(false);
  });

  it('keeps every field inside its page', () => {
    expect(createRequestInput.safeParse({ versionId: 'v', fields: [{ ...signature, x: 0.9 }] }).success).toBe(false);
  });
});

it('names the signed file after the original', () => {
  expect(signedFileName('Lettre explicative.pdf', 'signe')).toBe('Lettre explicative-signe.pdf');
});
