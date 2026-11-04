import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import type { ContractBlock } from '@/features/contracts/lib/contract-schema';
import { drawable, wrap } from '@/features/invoices/lib/invoice-pdf';
import type { ImageFile } from '@/features/signatures/lib/sign-pdf';
import type { SignatureField } from '@/features/signatures/lib/signature-schema';

/** Everything printed on a Contrat or an Avenant, already translated and filled in. */
export type ContractPdfData = {
  title: string;
  /** Under the title: « Contrat n° CTR-2026-0001 », « Avenant n° 1 au contrat CTR-2026-0001 ». */
  subtitle: string;
  blocks: ContractBlock[];
  /** The day it is sent, as the consultant's side of the signature block prints it. */
  sentOn: string;
  /** The consultant's signature and the company stamp, applied when sent; null in a template's preview without them. */
  consultant: { signature: ImageFile; stamp: ImageFile } | null;
  labels: {
    client: string;
    company: string;
    signature: string;
    name: string;
    date: string;
    page: (page: number, pages: number) => string;
  };
};

// Brand tokens (globals.css): navy-deep, rouge, slate, fog.
const NAVY = rgb(13 / 255, 31 / 255, 78 / 255);
const ROUGE = rgb(204 / 255, 22 / 255, 39 / 255);
const SLATE = rgb(74 / 255, 85 / 255, 104 / 255);
const FOG = rgb(200 / 255, 206 / 255, 216 / 255);

// The letterhead's blank area, as on Factures (invoice-pdf.ts).
const LEFT = 50;
const RIGHT = 545;
const TOP = 712;
const BOTTOM = 140;
const LINE = 14;
const BULLET_INDENT = 14;

// The signature block: the Client on the left, Stanzy on the right.
const BLOCK_HEIGHT = 170;
const COLUMN = 220;
const RIGHT_COLUMN = RIGHT - COLUMN;
const SIGNATURE_HEIGHT = 56;
const LINE_FIELD_HEIGHT = 18;

/**
 * Draws a Contrat on the Stanzy letterhead (`letterhead`: its one-page PDF),
 * its text continuing on more letterhead pages, then the signature block:
 * on the right the consultant's signature and the stamp, applied now; on
 * the left the Client's Signature, Nom complet and Date, returned as
 * `fields` for the Client to fill in online.
 */
export async function renderContractPdf(
  letterhead: Uint8Array,
  data: ContractPdfData,
): Promise<{ bytes: Uint8Array; fields: SignatureField[] }> {
  const template = await PDFDocument.load(letterhead);
  const doc = await PDFDocument.create();
  doc.setTitle(`${data.title} — ${data.subtitle}`);
  doc.setAuthor('Stanzy Immigration Consulting');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const embed = (file: ImageFile) => (file.type === 'image/png' ? doc.embedPng(file.bytes) : doc.embedJpg(file.bytes));
  const consultant = data.consultant
    ? { signature: await embed(data.consultant.signature), stamp: await embed(data.consultant.stamp) }
    : null;

  const newPage = async (): Promise<PDFPage> => {
    const [page] = await doc.copyPages(template, [0]);
    return doc.addPage(page!);
  };
  const text = (page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color = NAVY) =>
    page.drawText(drawable(value, font), { x, y, font, size, color });

  let page = await newPage();
  let y = TOP;
  /** Room for `height` more points, or a new page. */
  const room = async (height: number) => {
    if (y - height >= BOTTOM) return;
    page = await newPage();
    y = TOP;
  };

  for (const row of wrap(data.title.toUpperCase(), bold, 16, RIGHT - LEFT)) {
    text(page, row, LEFT, y - 18, bold, 16);
    y -= 20;
  }
  text(page, data.subtitle, LEFT, y - 12, regular, 10, SLATE);
  y -= 34;

  for (const block of data.blocks) {
    if (block.kind === 'heading') {
      const rows = wrap(block.text, bold, 11, RIGHT - LEFT);
      // A title never ends a page alone: it moves with its first line.
      await room(rows.length * LINE + 8 + LINE);
      y -= 6;
      for (const row of rows) {
        text(page, row, LEFT, y - 11, bold, 11);
        y -= LINE;
      }
      y -= 2;
      continue;
    }
    const indent = block.kind === 'bullet' ? BULLET_INDENT : 0;
    const rows = wrap(block.text, regular, 10, RIGHT - LEFT - indent);
    for (const [index, row] of rows.entries()) {
      await room(LINE);
      if (block.kind === 'bullet' && index === 0) text(page, '•', LEFT + 3, y - 10, regular, 10);
      text(page, row, LEFT + indent, y - 10, regular, 10);
      y -= LINE;
    }
    y -= block.kind === 'bullet' ? 2 : 8;
  }

  // The signature block, whole on one page.
  await room(BLOCK_HEIGHT);
  y -= 16;
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const pageIndex = doc.getPageCount() - 1;
  const field = (kind: SignatureField['kind'], top: number, height: number): SignatureField => ({
    kind,
    page: pageIndex,
    x: LEFT / pageWidth,
    y: (pageHeight - top) / pageHeight,
    width: COLUMN / pageWidth,
    height: height / pageHeight,
  });
  const underline = (x: number, at: number, caption: string) => {
    page.drawLine({ start: { x, y: at }, end: { x: x + COLUMN, y: at }, thickness: 0.75, color: FOG });
    text(page, caption, x, at - 10, regular, 8, SLATE);
  };

  text(page, data.labels.client.toUpperCase(), LEFT, y, bold, 9, ROUGE);
  text(page, data.labels.company.toUpperCase(), RIGHT_COLUMN, y, bold, 9, ROUGE);
  y -= 8;

  const signatureTop = y;
  const fields = [field('SIGNATURE', signatureTop, SIGNATURE_HEIGHT)];
  underline(LEFT, signatureTop - SIGNATURE_HEIGHT, data.labels.signature);
  // The consultant's signature on the left half of their column, the stamp on the right.
  const contain = (image: PDFImage, x: number, width: number) => {
    const scale = Math.min(width / image.width, (SIGNATURE_HEIGHT + 14) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: x + (width - w) / 2, y: signatureTop - SIGNATURE_HEIGHT + 2, width: w, height: h });
  };
  if (consultant) {
    contain(consultant.signature, RIGHT_COLUMN, COLUMN / 2);
    contain(consultant.stamp, RIGHT_COLUMN + COLUMN / 2, COLUMN / 2);
  }
  underline(RIGHT_COLUMN, signatureTop - SIGNATURE_HEIGHT, data.labels.signature);
  y = signatureTop - SIGNATURE_HEIGHT - 22;

  fields.push(field('NAME', y, LINE_FIELD_HEIGHT));
  underline(LEFT, y - LINE_FIELD_HEIGHT, data.labels.name);
  text(page, 'Stanzy Immigration Consulting', RIGHT_COLUMN, y - LINE_FIELD_HEIGHT + 5, regular, 10);
  underline(RIGHT_COLUMN, y - LINE_FIELD_HEIGHT, data.labels.name);
  y -= LINE_FIELD_HEIGHT + 22;

  fields.push(field('DATE', y, LINE_FIELD_HEIGHT));
  underline(LEFT, y - LINE_FIELD_HEIGHT, data.labels.date);
  text(page, data.sentOn, RIGHT_COLUMN, y - LINE_FIELD_HEIGHT + 5, regular, 10);
  underline(RIGHT_COLUMN, y - LINE_FIELD_HEIGHT, data.labels.date);

  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((target, index) => {
      const label = drawable(data.labels.page(index + 1, pages.length), regular);
      target.drawText(label, {
        x: RIGHT - regular.widthOfTextAtSize(label, 8),
        y: BOTTOM - 14,
        font: regular,
        size: 8,
        color: SLATE,
      });
    });
  }
  return { bytes: await doc.save(), fields };
}
