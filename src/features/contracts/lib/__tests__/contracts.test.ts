import { readFileSync } from 'node:fs';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { renderContractPdf, type ContractPdfData } from '@/features/contracts/lib/contract-pdf';
import {
  amendmentNumber,
  contractBlocks,
  contractNumber,
  fillBlanks,
  unknownBlanks,
} from '@/features/contracts/lib/contract-schema';
import { jpegOf } from '@/features/pdf-tools/lib/__tests__/fixtures';

const LETTERHEAD = new Uint8Array(readFileSync('src/features/invoices/assets/letterhead.pdf'));

const values = {
  client: 'Aminata Diallo',
  service: 'Accompagnement Entrée Express',
  prix: '500 000 FCFA',
  echeancier: '50 % à la signature',
  date: '4 novembre 2026',
  numero: 'CTR-2026-0001',
};

describe('the blanks', () => {
  it('fills the known ones and leaves any other {word} as written', () => {
    expect(fillBlanks('Entre {client} et Stanzy, pour {prix} ({echeancier}). {inconnu}', values)).toBe(
      'Entre Aminata Diallo et Stanzy, pour 500 000 FCFA (50 % à la signature). {inconnu}',
    );
  });

  it('points out the {word}s that are not blanks', () => {
    expect(unknownBlanks('{client} {clinet} {prix} {clinet} {Prix}')).toEqual(['clinet']);
  });
});

describe('the text of a template', () => {
  it('reads titles, bullets and paragraphs', () => {
    expect(contractBlocks('# Objet\nLe présent contrat\nporte sur {service}.\n\n- Étape 1\n• Étape 2\n\nFin.')).toEqual([
      { kind: 'heading', text: 'Objet' },
      { kind: 'paragraph', text: 'Le présent contrat\nporte sur {service}.' },
      { kind: 'bullet', text: 'Étape 1' },
      { kind: 'bullet', text: 'Étape 2' },
      { kind: 'paragraph', text: 'Fin.' },
    ]);
  });
});

it('numbers Contrats per year and Avenants after their Contrat', () => {
  expect(contractNumber(2026, 7)).toBe('CTR-2026-0007');
  expect(amendmentNumber('CTR-2026-0007', 2)).toBe('CTR-2026-0007-A2');
});

describe('the Contrat PDF', () => {
  const data = (paragraphs: number): ContractPdfData => ({
    title: 'Contrat de service',
    subtitle: 'Contrat n° CTR-2026-0001',
    blocks: Array.from({ length: paragraphs }, (_, n) => [
      { kind: 'heading' as const, text: `Article ${n + 1}` },
      { kind: 'paragraph' as const, text: 'Le prestataire accompagne le client. '.repeat(12) },
    ]).flat(),
    sentOn: '4 novembre 2026',
    consultant: {
      signature: { bytes: jpegOf(40, 20), type: 'image/jpeg' },
      stamp: { bytes: jpegOf(30, 30), type: 'image/jpeg' },
    },
    labels: {
      client: 'Le Client',
      company: 'Pour Stanzy Immigration Consulting',
      signature: 'Signature',
      name: 'Nom complet',
      date: 'Date',
      page: (page, pages) => `Page ${page} / ${pages}`,
    },
  });

  it('ends with the Client’s Signature, Nom complet and Date, on its last page', async () => {
    const { bytes, fields } = await renderContractPdf(LETTERHEAD, data(2));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(fields.map((field) => field.kind)).toEqual(['SIGNATURE', 'NAME', 'DATE']);
    for (const field of fields) {
      expect(field.page).toBe(0);
      expect(field.x).toBeGreaterThan(0);
      expect(field.y + field.height).toBeLessThan(1);
    }
    // One under the other.
    expect(fields[0]!.y).toBeLessThan(fields[1]!.y);
    expect(fields[1]!.y).toBeLessThan(fields[2]!.y);
  });

  it('runs onto more letterhead pages, the signature block on the last one', async () => {
    const { bytes, fields } = await renderContractPdf(LETTERHEAD, data(14));
    const pages = (await PDFDocument.load(bytes)).getPageCount();
    expect(pages).toBeGreaterThan(1);
    expect(fields.every((field) => field.page === pages - 1)).toBe(true);
  });
});
