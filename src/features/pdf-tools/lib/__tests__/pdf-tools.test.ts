import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { jpegOf, pdfSource, photoSource } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { buildPdf, COMPRESSION_STEPS, compressPdf, compressToLimit } from '@/features/pdf-tools/lib/build-pdf';
import { moved, movedOnto, rotated, withoutPage, withSource } from '@/features/pdf-tools/lib/pages';

describe('the pages', () => {
  it('lists every page of each file added, then moves, turns and removes them', async () => {
    const pages = withSource(withSource([], await pdfSource('a', 2)), photoSource('b', 1, 1));
    expect(pages.map((p) => [p.sourceId, p.index])).toEqual([
      ['a', 0],
      ['a', 1],
      ['b', 0],
    ]);
    const photo = pages[2]!.id;
    expect(moved(pages, photo, 0).map((p) => p.sourceId)).toEqual(['b', 'a', 'a']);
    expect(moved(pages, photo, 99).at(-1)!.id).toBe(photo);
    expect(rotated(rotated(pages, photo, -1), photo, -1).find((p) => p.id === photo)!.rotation).toBe(180);
    expect(rotated(pages, photo, 1).find((p) => p.id === photo)!.rotation).toBe(90);
    expect(withoutPage(pages, photo)).toHaveLength(2);
  });

  it('drops a dragged page where the one it was dropped on stood', async () => {
    const pages = withSource([], await pdfSource('a', 4));
    const [first, , third, fourth] = pages.map((p) => p.id);
    expect(movedOnto(pages, first!, third!).map((p) => p.index)).toEqual([1, 2, 0, 3]);
    expect(movedOnto(pages, fourth!, first!).map((p) => p.index)).toEqual([3, 0, 1, 2]);
    expect(movedOnto(pages, first!, first!)).toBe(pages);
  });
});

describe('the output PDF', () => {
  it('keeps the chosen order and rotations, PDF pages as they were', async () => {
    const a = await pdfSource('a', 3);
    const all = withSource([], a);
    const reordered = rotated(moved(all, all[0]!.id, 2), all[0]!.id, 1);
    const doc = await PDFDocument.load(await buildPdf([a], reordered));
    expect(doc.getPages().map((p) => p.getHeight())).toEqual([110, 120, 100]);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 90]);
  });

  it('puts a photo on an A4 page turned to its shape', async () => {
    const wide = photoSource('wide', 400, 200);
    const tall = photoSource('tall', 200, 400);
    const doc = await PDFDocument.load(await buildPdf([wide, tall], withSource(withSource([], wide), tall)));
    const [landscape, portrait] = doc.getPages();
    expect(landscape!.getWidth()).toBeGreaterThan(landscape!.getHeight());
    expect(Math.round(portrait!.getWidth())).toBe(595);
  });
});

describe('compression', () => {
  it('redraws each page as a JPEG of the page’s size', async () => {
    const pdf = await buildPdf([await pdfSource('a', 2)], withSource([], await pdfSource('a', 2)));
    const compressed = await compressPdf(pdf, COMPRESSION_STEPS[0], async () => [
      { jpeg: jpegOf(), width: 200, height: 100 },
      { jpeg: jpegOf(), width: 200, height: 110 },
    ]);
    const doc = await PDFDocument.load(compressed);
    expect(doc.getPages().map((p) => p.getHeight())).toEqual([100, 110]);
  });

  it('steps down until it fits, and says how close the strongest got when it can’t', async () => {
    const sizes = [9, 7, 5, 3];
    const seen: number[] = [];
    const result = await compressToLimit(
      async () => new Uint8Array(sizes.shift()!),
      4,
      (step) => seen.push(step.size),
    );
    expect(seen).toEqual([9, 7, 5, 3]);
    expect(result).toMatchObject({ quality: COMPRESSION_STEPS[3].quality });

    await expect(compressToLimit(async () => new Uint8Array(10), 4)).rejects.toMatchObject({
      message: 'PDF_TOO_LARGE',
      size: 10,
    });
  });
});
