import { degrees, PDFDocument } from 'pdf-lib';

import type { Page, Source } from '@/features/pdf-tools/lib/pages';

/** A4 in points, portrait. */
const A4 = { width: 595.28, height: 841.89 };
/** Space kept around a photo on its page. */
const MARGIN = 24;

/**
 * Draws each page of a PDF as a JPEG (the browser does it with pdf.js), at
 * `scale` times its size in points, with the page's rotation already applied.
 * `width` / `height` are the page's size in points.
 */
export type RasterizePdf = (
  pdf: Uint8Array,
  options: { quality: number; scale: number },
) => Promise<{ jpeg: Uint8Array; width: number; height: number }[]>;

/**
 * The output PDF: `pages` in order, each rotated as set. PDF pages are copied
 * as they are (text stays selectable); a photo is centred on an A4 page
 * turned to its shape.
 */
export async function buildPdf(sources: Source[], pages: Page[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const byId = new Map(sources.map((source) => [source.id, source]));
  const loaded = new Map<string, PDFDocument>();

  for (const page of pages) {
    const source = byId.get(page.sourceId);
    if (!source) continue;

    if (source.kind === 'pdf') {
      let doc = loaded.get(source.id);
      if (!doc) {
        doc = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
        loaded.set(source.id, doc);
      }
      const [copy] = await out.copyPages(doc, [page.index]);
      copy!.setRotation(degrees((copy!.getRotation().angle + page.rotation) % 360));
      out.addPage(copy!);
      continue;
    }

    const image = source.mime === 'image/png' ? await out.embedPng(source.bytes) : await out.embedJpg(source.bytes);
    const landscape = image.width > image.height;
    const size = landscape ? { width: A4.height, height: A4.width } : A4;
    const fit = Math.min((size.width - 2 * MARGIN) / image.width, (size.height - 2 * MARGIN) / image.height, 1);
    const drawn = out.addPage([size.width, size.height]);
    drawn.drawImage(image, {
      x: (size.width - image.width * fit) / 2,
      y: (size.height - image.height * fit) / 2,
      width: image.width * fit,
      height: image.height * fit,
    });
    drawn.setRotation(degrees(page.rotation));
  }
  return out.save();
}

/**
 * The same pages, each redrawn as a JPEG at `quality` and `scale`: much
 * smaller, but their text is no longer selectable.
 */
export async function compressPdf(
  pdf: Uint8Array,
  step: { quality: number; scale: number },
  rasterize: RasterizePdf,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const { jpeg, width, height } of await rasterize(pdf, step)) {
    const image = await out.embedJpg(jpeg);
    out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  return out.save();
}

/** The steps « Compresser jusqu'à 4 Mo » goes through, from light to strong. */
export const COMPRESSION_STEPS = [
  { quality: 0.85, scale: 1.5 },
  { quality: 0.75, scale: 1.25 },
  { quality: 0.65, scale: 1.1 },
  { quality: 0.55, scale: 1 },
  { quality: 0.45, scale: 0.9 },
  { quality: 0.35, scale: 0.8 },
] as const;

/**
 * Compresses step by step until the PDF fits `limit`, reporting each try
 * (`onStep`). Resolves to the first that fits, or rejects PDF_TOO_LARGE
 * after the strongest step, with that last size.
 */
export async function compressToLimit(
  build: (step: { quality: number; scale: number }) => Promise<Uint8Array>,
  limit: number,
  onStep?: (step: { quality: number; scale: number; size: number }) => void,
): Promise<{ bytes: Uint8Array; quality: number; scale: number }> {
  let last = 0;
  for (const step of COMPRESSION_STEPS) {
    const bytes = await build(step);
    last = bytes.byteLength;
    onStep?.({ ...step, size: last });
    if (last <= limit) return { bytes, ...step };
  }
  throw Object.assign(new Error('PDF_TOO_LARGE'), { size: last });
}
