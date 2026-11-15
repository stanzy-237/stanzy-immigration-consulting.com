import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import type { NoteDoc, NoteNode } from '@/features/document-services/lib/handoff';
import { drawable } from '@/features/invoices/lib/invoice-pdf';

/** A stretch of text in one style. */
export type Run = { text: string; bold: boolean; italic: boolean };
/** One block of the note as the PDF lays it out: `level` indents a list item, `marker` is its bullet or number. */
export type NoteLine = { kind: 'heading' | 'paragraph'; level: number; marker: string | null; runs: Run[] };

const has = (node: NoteNode, mark: string) => node.marks?.some((one) => one.type === mark) ?? false;

function runsOf(node: NoteNode, heading: boolean): Run[] {
  return (node.content ?? []).flatMap((child): Run[] => {
    if (child.type === 'hardBreak') return [{ text: '\n', bold: heading, italic: false }];
    if (child.type !== 'text' || !child.text) return [];
    return [{ text: child.text, bold: heading || has(child, 'bold'), italic: has(child, 'italic') }];
  });
}

/** The editor's document as lines, top to bottom; what the PDF can't show (images…) is skipped. */
export function noteLines(doc: NoteDoc): NoteLine[] {
  const lines: NoteLine[] = [];
  const walk = (nodes: NoteNode[], level: number) => {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const value = Number(node.attrs?.level ?? 2);
        lines.push({ kind: 'heading', level: value, marker: null, runs: runsOf(node, true) });
      } else if (node.type === 'paragraph') {
        lines.push({ kind: 'paragraph', level, marker: null, runs: runsOf(node, false) });
      } else if (node.type === 'blockquote') {
        walk(node.content ?? [], level + 1);
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        const start = Number(node.attrs?.start ?? 1);
        (node.content ?? []).forEach((item, index) => {
          const first = lines.length;
          walk(item.content ?? [], level + 1);
          const marker = node.type === 'bulletList' ? '•' : `${start + index}.`;
          if (lines[first]) lines[first] = { ...lines[first]!, marker };
        });
      }
    }
  };
  walk(doc.content ?? [], 0);
  return lines;
}

// The letterhead's blank area (as the Facture's), and the note's look.
const LEFT = 50;
const RIGHT = 545;
const TOP = 712;
const BOTTOM = 140;
const INDENT = 18;
const NAVY = rgb(13 / 255, 31 / 255, 78 / 255);
const SLATE = rgb(74 / 255, 85 / 255, 104 / 255);
const SIZES: Record<number, number> = { 1: 18, 2: 15, 3: 13 };
const BODY = 10.5;

/**
 * The partner note (#148) on the Stanzy letterhead (`letterhead`: its
 * one-page PDF): titles, bold and italic, bullets and numbers, continuing
 * on another letterhead page when it doesn't fit. Standard Helvetica, so
 * characters outside Western European text are dropped.
 */
export async function renderNotePdf(letterhead: Uint8Array, data: { title: string; doc: NoteDoc }): Promise<Uint8Array> {
  const template = await PDFDocument.load(letterhead);
  const doc = await PDFDocument.create();
  doc.setTitle(data.title);
  doc.setAuthor('Stanzy Immigration Consulting');
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const fontOf = (run: Run): PDFFont =>
    run.bold ? (run.italic ? fonts.boldItalic : fonts.bold) : run.italic ? fonts.italic : fonts.regular;

  const newPage = async (): Promise<PDFPage> => {
    const [page] = await doc.copyPages(template, [0]);
    return doc.addPage(page!);
  };
  let page = await newPage();
  let y = TOP;

  for (const line of noteLines(data.doc)) {
    const size = line.kind === 'heading' ? (SIZES[line.level] ?? 13) : BODY;
    const leading = size * 1.4;
    const indent = line.kind === 'heading' ? 0 : line.level * INDENT;
    const left = LEFT + indent + (line.marker ? 14 : 0);
    if (line.kind === 'heading') y -= 6;

    // Words in their style, laid out row by row; a word too wide for a row goes on its own.
    const words = line.runs.flatMap((run) =>
      drawable(run.text.replace(/\n/g, ' \n '), fontOf(run))
        .split(/( +)/)
        .filter((word) => word !== '')
        .map((word) => ({ word, font: fontOf(run) })),
    );
    const rows: { word: string; font: PDFFont }[][] = [[]];
    let width = 0;
    for (const piece of words) {
      if (piece.word.trim() === '\n') {
        rows.push([]);
        width = 0;
        continue;
      }
      const wide = piece.font.widthOfTextAtSize(piece.word, size);
      const row = rows.at(-1)!;
      if (width + wide > RIGHT - left && row.length > 0 && piece.word.trim() !== '') {
        rows.push([piece]);
        width = wide;
      } else if (!(row.length === 0 && piece.word.trim() === '')) {
        row.push(piece);
        width += wide;
      }
    }

    for (const [index, row] of rows.entries()) {
      if (y - leading < BOTTOM) {
        page = await newPage();
        y = TOP;
      }
      y -= leading;
      if (index === 0 && line.marker) {
        page.drawText(line.marker, { x: LEFT + indent, y, font: fonts.regular, size, color: SLATE });
      }
      let x = left;
      for (const piece of row) {
        page.drawText(piece.word, { x, y, font: piece.font, size, color: NAVY });
        x += piece.font.widthOfTextAtSize(piece.word, size);
      }
    }
    y -= line.kind === 'heading' ? 4 : 6;
  }
  return doc.save();
}
