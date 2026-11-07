import { PDFDocument } from 'pdf-lib';

/** A4 in PDF points. */
const A4 = { width: 595.28, height: 841.89 } as const;
/** How wide the signature sits on the page, at most. */
const SIGNATURE_WIDTH = 220;

/**
 * A blank A4 page with nothing but the signature drawn on screen (a
 * transparent PNG data URL) in its middle: what the bank asks for as a
 * « signature numérique » (#80).
 */
export async function signaturePage(png: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.width, A4.height]);
  const image = await pdf.embedPng(png);
  const scale = Math.min(1, SIGNATURE_WIDTH / image.width);
  const { width, height } = image.scale(scale);
  page.drawImage(image, { x: (A4.width - width) / 2, y: (A4.height - height) / 2, width, height });
  return pdf.save();
}
