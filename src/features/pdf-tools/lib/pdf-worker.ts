/**
 * pdf.js's worker, behind the polyfills an older Safari needs (pdf-polyfills.ts):
 * they are installed first, then the real worker starts. Loaded by `loadPdfJs`.
 */
import { installPdfPolyfills } from '@/features/pdf-tools/lib/pdf-polyfills';

installPdfPolyfills();
// @ts-expect-error -- pdf.js ships no types for its worker bundle; it only needs running.
await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
