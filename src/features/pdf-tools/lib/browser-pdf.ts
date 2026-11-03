import { PDFDocument } from 'pdf-lib';

import type { RasterizePdf } from '@/features/pdf-tools/lib/build-pdf';
import type { Rotation, Source } from '@/features/pdf-tools/lib/pages';

/**
 * The Outils PDF's work in the consultant's browser (#79): reading the files
 * added, drawing page thumbnails and redrawing pages as JPEG, with pdf.js
 * (loaded on first use, its worker beside it). Nothing leaves the browser.
 */

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return lib;
  });
  return pdfjs;
}

/** What can be added: PDFs and photos (HEIC is converted, WebP redrawn). */
export const ACCEPTED = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** A file from the computer (or a Version), ready to work with. Rejects PDF_UNREADABLE or PDF_UNSUPPORTED. */
export async function readSource(file: Blob, name: string, id: string): Promise<Source> {
  const type = file.type || '';
  const ext = extension(name);

  if (type === 'application/pdf' || ext === 'pdf') {
    const bytes = await file.arrayBuffer();
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return { id, name, kind: 'pdf', bytes, mime: 'application/pdf', pageCount: doc.getPageCount() };
    } catch {
      throw new Error('PDF_UNREADABLE');
    }
  }
  if (type === 'image/jpeg' || type === 'image/png' || ['jpg', 'jpeg', 'png'].includes(ext)) {
    const mime = type === 'image/png' || ext === 'png' ? 'image/png' : 'image/jpeg';
    return { id, name, kind: 'image', bytes: await file.arrayBuffer(), mime, pageCount: 1 };
  }
  if (type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif') {
    // Large (libheif): only fetched when an iPhone photo is added.
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const jpeg = Array.isArray(converted) ? converted[0]! : converted;
    return { id, name, kind: 'image', bytes: await jpeg.arrayBuffer(), mime: 'image/jpeg', pageCount: 1 };
  }
  if (type === 'image/webp' || ext === 'webp') {
    return { id, name, kind: 'image', bytes: await redrawAsJpeg(file), mime: 'image/jpeg', pageCount: 1 };
  }
  throw new Error('PDF_UNSUPPORTED');
}

async function redrawAsJpeg(file: Blob): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return (await canvasJpeg(canvas, 0.92)).buffer as ArrayBuffer;
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error('JPEG'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** A small image of one page, as the grid shows it (rotation applied). */
export async function thumbnail(source: Source, index: number, rotation: Rotation, width = 180): Promise<string> {
  if (source.kind === 'image') {
    return URL.createObjectURL(new Blob([source.bytes], { type: source.mime }));
  }
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(source.bytes.slice(0)) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(index + 1);
    const base = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
    const viewport = page.getViewport({ scale: width / base.width, rotation: page.rotate + rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  } finally {
    await task.destroy();
  }
}

/** Every page of `pdf` redrawn as a JPEG at `scale` × its size in points (see `compressPdf`). */
export const rasterizePdf: RasterizePdf = async (pdf, { quality, scale }) => {
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: pdf.slice(0) });
  const doc = await task.promise;
  try {
    const pages: { jpeg: Uint8Array; width: number; height: number }[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d')!;
      // JPEG has no transparency: start from white paper.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pages.push({ jpeg: await canvasJpeg(canvas, quality), width: size.width, height: size.height });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
};
