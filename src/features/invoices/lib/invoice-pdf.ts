import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import { formatMoney, invoiceTotal, lineTotal, type Currency } from '@/features/invoices/lib/money';

/** Everything printed on a Facture, already translated. */
export type InvoicePdfData = {
  locale: string;
  number: string;
  issuedOn: Date;
  dueDate: Date | null;
  currency: Currency;
  client: { name: string; email: string };
  service: string;
  lines: { description: string; quantity: number; unitAmount: number }[];
  notes: string | null;
  /** Stamped across the page: PAID « Payée », CANCELLED « Annulée ». */
  stamp: 'PAID' | 'CANCELLED' | null;
  labels: {
    title: string;
    number: string;
    issuedOn: string;
    dueDate: string;
    billedTo: string;
    dossier: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
    total: string;
    notes: string;
    page: (page: number, pages: number) => string;
    paid: string;
    cancelled: string;
  };
};

// Brand tokens (globals.css): navy-deep, rouge, slate, fog-light, leaf.
const NAVY = rgb(13 / 255, 31 / 255, 78 / 255);
const ROUGE = rgb(204 / 255, 22 / 255, 39 / 255);
const SLATE = rgb(74 / 255, 85 / 255, 104 / 255);
const FOG = rgb(226 / 255, 230 / 255, 236 / 255);
const LEAF = rgb(31 / 255, 138 / 255, 76 / 255);

// The letterhead's blank area, in points on its A4 page: under the logo and
// the NIU band, above the social links and the address.
const LEFT = 50;
const RIGHT = 545;
const TOP = 712;
const BOTTOM = 140;

// Table columns: description on the left, the three numbers right-aligned.
const DESCRIPTION_WIDTH = 250;
const QUANTITY_RIGHT = 360;
const UNIT_RIGHT = 450;
const AMOUNT_RIGHT = RIGHT - 6;

/**
 * Draws a Facture on the Stanzy letterhead (`letterhead`: its one-page PDF).
 * Lines that don't fit continue on another letterhead page. Uses the PDF's
 * standard Helvetica, so characters outside Western European text are dropped.
 */
export async function renderInvoicePdf(letterhead: Uint8Array, data: InvoicePdfData): Promise<Uint8Array> {
  const template = await PDFDocument.load(letterhead);
  const doc = await PDFDocument.create();
  doc.setTitle(`${data.labels.title} ${data.number}`);
  doc.setAuthor('Stanzy Immigration Consulting');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { labels } = data;
  const money = (minor: number) => formatMoney(minor, data.currency, data.locale);
  const date = (value: Date, timeZone: string) =>
    new Intl.DateTimeFormat(data.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(value);

  const newPage = async (): Promise<PDFPage> => {
    const [page] = await doc.copyPages(template, [0]);
    return doc.addPage(page!);
  };
  const text = (page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color = NAVY) =>
    page.drawText(drawable(value, font), { x, y, font, size, color });
  const textRight = (
    page: PDFPage,
    value: string,
    right: number,
    y: number,
    font: PDFFont,
    size: number,
    color = NAVY,
  ) => {
    const safe = drawable(value, font);
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y, font, size, color });
  };

  let page = await newPage();
  let y = TOP;

  // Title and dates.
  text(page, labels.title.toUpperCase(), LEFT, y - 22, bold, 24);
  text(page, `${labels.number} ${data.number}`, LEFT, y - 40, regular, 11, SLATE);
  textRight(page, `${labels.issuedOn} : ${date(data.issuedOn, 'Africa/Douala')}`, RIGHT, y - 18, regular, 10);
  if (data.dueDate) textRight(page, `${labels.dueDate} : ${date(data.dueDate, 'UTC')}`, RIGHT, y - 33, bold, 10);
  y -= 72;

  // Who it's for.
  text(page, labels.billedTo.toUpperCase(), LEFT, y, bold, 9, ROUGE);
  text(page, data.client.name, LEFT, y - 15, bold, 11);
  text(page, data.client.email, LEFT, y - 29, regular, 10, SLATE);
  text(page, `${labels.dossier} : ${data.service}`, LEFT, y - 43, regular, 10, SLATE);
  y -= 68;

  const header = (target: PDFPage, top: number) => {
    target.drawRectangle({ x: LEFT, y: top - 22, width: RIGHT - LEFT, height: 22, color: NAVY });
    const white = rgb(1, 1, 1);
    text(target, labels.description, LEFT + 6, top - 15, bold, 9, white);
    textRight(target, labels.quantity, QUANTITY_RIGHT, top - 15, bold, 9, white);
    textRight(target, labels.unitPrice, UNIT_RIGHT, top - 15, bold, 9, white);
    textRight(target, labels.amount, AMOUNT_RIGHT, top - 15, bold, 9, white);
    return top - 22;
  };
  y = header(page, y);

  for (const line of data.lines) {
    const rows = wrap(line.description, regular, 10, DESCRIPTION_WIDTH);
    const height = rows.length * 13 + 10;
    if (y - height < BOTTOM) {
      page = await newPage();
      y = header(page, TOP);
    }
    rows.forEach((row, index) => text(page, row, LEFT + 6, y - 15 - index * 13, regular, 10));
    textRight(page, String(line.quantity), QUANTITY_RIGHT, y - 15, regular, 10);
    textRight(page, money(line.unitAmount), UNIT_RIGHT, y - 15, regular, 10);
    textRight(page, money(lineTotal(line)), AMOUNT_RIGHT, y - 15, regular, 10);
    y -= height;
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.75, color: FOG });
  }

  // Total, then the notes; each moves to a new page if it doesn't fit.
  const noteRows = data.notes ? wrap(data.notes, regular, 10, RIGHT - LEFT) : [];
  if (y - 40 < BOTTOM) {
    page = await newPage();
    y = TOP;
  }
  page.drawRectangle({ x: UNIT_RIGHT - 110, y: y - 34, width: RIGHT - UNIT_RIGHT + 110, height: 26, color: FOG });
  text(page, labels.total, UNIT_RIGHT - 100, y - 25, bold, 12);
  textRight(page, money(invoiceTotal(data.lines)), AMOUNT_RIGHT, y - 25, bold, 12);
  y -= 58;

  if (noteRows.length > 0) {
    if (y - 18 - noteRows.length * 13 < BOTTOM) {
      page = await newPage();
      y = TOP;
    }
    text(page, labels.notes.toUpperCase(), LEFT, y, bold, 9, ROUGE);
    noteRows.forEach((row, index) => text(page, row, LEFT, y - 15 - index * 13, regular, 10, SLATE));
  }

  if (data.stamp) {
    const first = doc.getPage(0);
    const word = (data.stamp === 'PAID' ? labels.paid : labels.cancelled).toUpperCase();
    const color = data.stamp === 'PAID' ? LEAF : ROUGE;
    first.drawText(drawable(word, bold), {
      x: 300,
      y: 560,
      font: bold,
      size: 44,
      color,
      opacity: 0.35,
      rotate: degrees(20),
    });
  }

  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((target, index) =>
      textRight(target, labels.page(index + 1, pages.length), RIGHT, BOTTOM - 14, regular, 8, SLATE),
    );
  }
  return doc.save();
}

/** `value` without what the standard font can't draw (and with plain spaces). */
function drawable(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...value.replace(/[  \t]/g, ' ')].filter((char) => supported.has(char.codePointAt(0)!)).join('');
}

/** Splits `value` into rows that fit `width`, breaking on spaces (and inside a word too long for a row). */
export function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const rows: string[] = [];
  for (const paragraph of value
    .replace(/\r/g, '')
    .split('\n')
    .map((part) => drawable(part, font))) {
    let row = '';
    for (const word of paragraph.split(' ')) {
      const candidate = row ? `${row} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        row = candidate;
        continue;
      }
      if (row) rows.push(row);
      row = word;
      while (font.widthOfTextAtSize(row, size) > width) {
        let cut = row.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(row.slice(0, cut), size) > width) cut--;
        rows.push(row.slice(0, cut));
        row = row.slice(cut);
      }
    }
    rows.push(row);
  }
  return rows;
}
