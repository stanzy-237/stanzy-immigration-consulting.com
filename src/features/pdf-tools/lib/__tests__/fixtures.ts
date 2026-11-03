import { PDFDocument } from 'pdf-lib';

import type { Source } from '@/features/pdf-tools/lib/pages';

/** A PDF with `count` pages, each its own height (100 + 10 × n points) so tests can tell them apart. */
export async function pdfOf(count: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let n = 0; n < count; n++) doc.addPage([200, 100 + 10 * n]);
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** A tiny baseline JPEG whose header says `width` × `height`: enough for pdf-lib to embed. */
export function jpegOf(width = 1, height = 1): Uint8Array {
  const bytes = Uint8Array.from(
    atob(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    ),
    (c) => c.charCodeAt(0),
  );
  // Its frame header (SOF0–SOF3) holds the size.
  const sof = bytes.findIndex((b, i) => b === 0xff && [0xc0, 0xc1, 0xc2, 0xc3].includes(bytes[i + 1]!));
  bytes[sof + 5] = height >> 8;
  bytes[sof + 6] = height & 0xff;
  bytes[sof + 7] = width >> 8;
  bytes[sof + 8] = width & 0xff;
  return bytes;
}

export const pdfSource = async (id: string, count: number): Promise<Source> => ({
  id,
  name: `${id}.pdf`,
  kind: 'pdf',
  bytes: await pdfOf(count),
  mime: 'application/pdf',
  pageCount: count,
});

export const photoSource = (id: string, width: number, height: number): Source => {
  const jpeg = jpegOf(width, height);
  return { id, name: `${id}.jpg`, kind: 'image', bytes: jpeg.buffer as ArrayBuffer, mime: 'image/jpeg', pageCount: 1 };
};
