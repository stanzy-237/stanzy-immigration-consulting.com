import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { drawable, wrap } from '@/features/invoices/lib/invoice-pdf';
import type { SignatureField } from '@/features/signatures/lib/signature-schema';

/** An image to draw: the bytes and whether they are PNG or JPEG. */
export type ImageFile = { bytes: Uint8Array; type: 'image/png' | 'image/jpeg' };

/** Everything drawn on a signed PDF, already translated. */
export type SignPdfData = {
  fields: SignatureField[];
  /** The Client's drawn signature (PNG). */
  signature: Uint8Array;
  /** The full name they typed, in NAME fields. */
  name: string;
  /** The day they signed, as DATE fields print it. */
  date: string;
  /** The consultant's signature and the company stamp, for STAMP fields. */
  consultant: { signature: ImageFile; stamp: ImageFile } | null;
  /**
   * The Certificat de signature, added as the last page: a title, label/value
   * rows, a closing note. Contrats only: a document for IRCC stays as it was,
   * the signature aside (null).
   */
  certificate: { title: string; rows: [string, string][]; note: string } | null;
  /** The Stanzy letterhead (one-page PDF) the Certificat is printed on; a blank A4 page without it. */
  letterhead: Uint8Array | null;
};

// Brand tokens (globals.css): navy-deep, rouge, slate.
const NAVY = rgb(13 / 255, 31 / 255, 78 / 255);
const ROUGE = rgb(204 / 255, 22 / 255, 39 / 255);
const SLATE = rgb(74 / 255, 85 / 255, 104 / 255);

// The letterhead's blank area, as on Factures (invoice-pdf.ts).
const LEFT = 50;
const RIGHT = 545;
const TOP = 712;
const A4: [number, number] = [595.28, 841.89];

/** Whether `bytes` is a PDF this can sign: readable and not encrypted. */
export async function pageCountOf(bytes: Uint8Array): Promise<number | null> {
  try {
    return (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    return null;
  }
}

/** SHA-256 of `bytes`, hex: the fingerprint of the exact PDF signed. */
export async function fingerprintOf(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The original PDF with the fields filled in where the consultant placed
 * them (on pages shown rotated too), and the Certificat de signature added
 * as its last page when given. Fields on a page it doesn't have are refused
 * (SIGNATURE_FIELD_OUTSIDE).
 */
export async function signPdf(original: Uint8Array, data: SignPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const signature = await doc.embedPng(data.signature);
  const embed = (file: ImageFile) => (file.type === 'image/png' ? doc.embedPng(file.bytes) : doc.embedJpg(file.bytes));
  const consultant = data.consultant
    ? { signature: await embed(data.consultant.signature), stamp: await embed(data.consultant.stamp) }
    : null;

  for (const field of data.fields) {
    const page = pages[field.page];
    if (!page) throw new Error('SIGNATURE_FIELD_OUTSIDE');
    const box = new FieldBox(page, field);
    if (field.kind === 'SIGNATURE') box.image(signature, 0, box.width);
    else if (field.kind === 'NAME') box.text(data.name, regular);
    else if (field.kind === 'DATE') box.text(data.date, regular);
    else {
      if (!consultant) throw new Error('SIGNATURE_ASSETS_MISSING');
      // The consultant's signature on the left half, the stamp on the right.
      box.image(consultant.signature, 0, box.width / 2);
      box.image(consultant.stamp, box.width / 2, box.width / 2);
    }
  }

  if (data.certificate) await addCertificate(doc, data.certificate, data.letterhead, { regular, bold });
  return doc.save();
}

type Crop = { x: number; y: number; width: number; height: number };

/**
 * Where a field placed on the page as shown lands in the page's own
 * coordinates: its box's bottom left as shown (`origin`), its size in points,
 * and the angle what is drawn in it turns by to read upright on a page with
 * a /Rotate of `rotation`.
 */
export function fieldPlacement(
  crop: Crop,
  rotation: number,
  field: Pick<SignatureField, 'x' | 'y' | 'width' | 'height'>,
): { origin: { x: number; y: number }; width: number; height: number; angle: number } {
  const normalized = ((rotation % 360) + 360) % 360;
  const angle = [90, 180, 270].includes(normalized) ? normalized : 0;
  const turned = angle === 90 || angle === 270;
  // A point shown at (u, v), fractions from the top left, in page coordinates.
  const at = (u: number, v: number) => {
    switch (angle) {
      case 90:
        return { x: crop.x + v * crop.width, y: crop.y + u * crop.height };
      case 180:
        return { x: crop.x + (1 - u) * crop.width, y: crop.y + v * crop.height };
      case 270:
        return { x: crop.x + (1 - v) * crop.width, y: crop.y + (1 - u) * crop.height };
      default:
        return { x: crop.x + u * crop.width, y: crop.y + (1 - v) * crop.height };
    }
  };
  return {
    origin: at(field.x, field.y + field.height),
    width: field.width * (turned ? crop.height : crop.width),
    height: field.height * (turned ? crop.width : crop.height),
    angle,
  };
}

/**
 * A field's box on its page. Fields are placed on the page as shown, so on
 * a page turned by its /Rotate, what is drawn turns with it to read upright.
 */
class FieldBox {
  readonly width: number;
  readonly height: number;
  private readonly origin: { x: number; y: number };
  private readonly angle: number;

  constructor(
    private readonly page: PDFPage,
    field: SignatureField,
  ) {
    const placement = fieldPlacement(page.getCropBox(), page.getRotation().angle, field);
    this.origin = placement.origin;
    this.angle = placement.angle;
    this.width = placement.width;
    this.height = placement.height;
  }

  /** `(dx, dy)` from the box's bottom left, along its shown right and up, in page coordinates. */
  private point(dx: number, dy: number) {
    const radians = (this.angle * Math.PI) / 180;
    const cos = Math.round(Math.cos(radians));
    const sin = Math.round(Math.sin(radians));
    return { x: this.origin.x + dx * cos - dy * sin, y: this.origin.y + dx * sin + dy * cos };
  }

  /** `image` fitted inside the strip from `left`, `width` wide, centred in it. */
  image(image: PDFImage, left: number, width: number): void {
    const scale = Math.min(width / image.width, this.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const at = this.point(left + (width - w) / 2, (this.height - h) / 2);
    this.page.drawImage(image, { ...at, width: w, height: h, rotate: degrees(this.angle) });
  }

  /** One line of text, as large as the box allows (12 pt at most), centred vertically. */
  text(value: string, font: PDFFont): void {
    const safe = drawable(value, font);
    let size = Math.min(12, this.height * 0.75);
    while (size > 5 && font.widthOfTextAtSize(safe, size) > this.width) size -= 0.5;
    const at = this.point(0, (this.height - font.heightAtSize(size, { descender: false })) / 2);
    this.page.drawText(safe, { ...at, size, font, color: NAVY, rotate: degrees(this.angle) });
  }
}

async function addCertificate(
  doc: PDFDocument,
  certificate: NonNullable<SignPdfData['certificate']>,
  letterhead: Uint8Array | null,
  fonts: { regular: PDFFont; bold: PDFFont },
): Promise<void> {
  let page: PDFPage;
  if (letterhead) {
    const [copied] = await doc.copyPages(await PDFDocument.load(letterhead), [0]);
    page = doc.addPage(copied!);
  } else {
    page = doc.addPage(A4);
  }
  const { regular, bold } = fonts;
  const width = RIGHT - LEFT;
  let y = TOP - 24;
  page.drawText(drawable(certificate.title.toUpperCase(), bold), { x: LEFT, y, size: 18, font: bold, color: NAVY });
  y -= 34;

  for (const [label, value] of certificate.rows) {
    page.drawText(drawable(label.toUpperCase(), bold), { x: LEFT, y, size: 8, font: bold, color: ROUGE });
    y -= 14;
    for (const row of wrap(value, regular, 10, width)) {
      page.drawText(row, { x: LEFT, y, size: 10, font: regular, color: NAVY });
      y -= 13;
    }
    y -= 9;
  }

  y -= 6;
  for (const row of wrap(certificate.note, regular, 8, width)) {
    page.drawText(row, { x: LEFT, y, size: 8, font: regular, color: SLATE });
    y -= 11;
  }
}
