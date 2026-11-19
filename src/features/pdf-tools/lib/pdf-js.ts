import { installPdfPolyfills } from '@/features/pdf-tools/lib/pdf-polyfills';

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | null = null;

/**
 * pdf.js, loaded once on first use, with its worker. The legacy build, plus
 * the Safari 17.4 features it calls without polyfilling (pdf-polyfills.ts),
 * installed here and in the worker (pdf-worker.ts): an iPhone on iOS 17.1
 * could not open a Contrat to sign without them.
 *
 * On its own, apart from browser-pdf.ts (#165): the pages that only show a
 * PDF to sign don't download pdf-lib and its fonts with it.
 */
export function loadPdfJs(): Promise<PdfJs> {
  installPdfPolyfills();
  pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
    return lib;
  });
  return pdfjs;
}
