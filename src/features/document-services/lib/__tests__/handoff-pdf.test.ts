import { readFileSync } from 'node:fs';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import type { NoteDoc, NoteNode } from '@/features/document-services/lib/handoff';
import { noteLines, renderNotePdf } from '@/features/document-services/lib/handoff-pdf';

const letterhead = readFileSync('src/features/invoices/assets/letterhead.pdf');
const text = (value: string, ...marks: string[]): NoteNode => ({
  type: 'text',
  text: value,
  ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (...content: NoteNode[]): NoteNode => ({ type: 'paragraph', content });

const note: NoteDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('Dossier de Aminata Diallo')] },
    paragraph(text('Employée chez '), text('Brasseries du Cameroun', 'bold'), text(' depuis le '), text('01/03/2019', 'italic'), text(' ✅')),
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [paragraph(text('Passeport'))] }, { type: 'listItem', content: [paragraph(text('NIU'))] }],
    },
    { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Ouvrir le compte'))] }] },
  ],
};

describe('the partner note as a PDF (#148)', () => {
  it('reads the editor’s document as lines: titles, bold and italic runs, bullets and numbers', () => {
    expect(noteLines(note)).toEqual([
      { kind: 'heading', level: 2, runs: [{ text: 'Dossier de Aminata Diallo', bold: true, italic: false }], marker: null },
      {
        kind: 'paragraph',
        level: 0,
        marker: null,
        runs: [
          { text: 'Employée chez ', bold: false, italic: false },
          { text: 'Brasseries du Cameroun', bold: true, italic: false },
          { text: ' depuis le ', bold: false, italic: false },
          { text: '01/03/2019', bold: false, italic: true },
          { text: ' ✅', bold: false, italic: false },
        ],
      },
      { kind: 'paragraph', level: 1, marker: '•', runs: [{ text: 'Passeport', bold: false, italic: false }] },
      { kind: 'paragraph', level: 1, marker: '•', runs: [{ text: 'NIU', bold: false, italic: false }] },
      { kind: 'paragraph', level: 1, marker: '1.', runs: [{ text: 'Ouvrir le compte', bold: false, italic: false }] },
    ]);
  });

  it('draws it on the A4 letterhead, its title set, characters the font lacks dropped', async () => {
    const pdf = await PDFDocument.load(await renderNotePdf(letterhead, { title: 'Note – Preuve de fonds', doc: note }));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
    expect(pdf.getTitle()).toBe('Note – Preuve de fonds');
  });

  it('continues on another letterhead page when it doesn’t fit', async () => {
    const long: NoteDoc = { type: 'doc', content: Array.from({ length: 60 }, (_, n) => paragraph(text(`Ligne ${n} `.repeat(12)))) };
    const pdf = await PDFDocument.load(await renderNotePdf(letterhead, { title: 'Note', doc: long }));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
