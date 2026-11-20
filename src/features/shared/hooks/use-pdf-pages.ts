'use client';

import { useEffect, useState } from 'react';

import { loadPdfJs } from '@/features/pdf-tools/lib/pdf-js';

/** One page drawn for reading: an image, and its shape as shown (rotation applied). */
export type ShownPage = { src: string; width: number; height: number };

/** The widest pages are drawn, in pixels: sharp enough to read a letter on a large screen. */
const MAX_DRAW_WIDTH = 1100;

/**
 * How wide to draw pages on this screen (#165): its width at up to twice its
 * pixel density, at most MAX_DRAW_WIDTH. A phone draws about half the pixels
 * a desktop does, and reads just as sharp.
 */
export function drawWidth(screenWidth: number, pixelRatio: number): number {
  return Math.min(MAX_DRAW_WIDTH, Math.round(screenWidth * Math.min(Math.max(pixelRatio, 1), 2)));
}

/** A drawn page as a JPEG, encoded off the main thread where the browser can. */
const toJpeg = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PDF page not drawn'))), 'image/jpeg', 0.85),
  );

/**
 * The PDFs being downloaded, by URL (#165): a second ask for the same file
 * while the first is on its way (React runs effects twice in development, a
 * remount) shares its download, and with it the page's preload
 * (src/features/shared/lib/preload-pdf.ts). Forgotten once settled, so a
 * later visit gets the file as it is then (signed, say).
 */
const downloads = new Map<string, Promise<ArrayBuffer>>();

function download(url: string): Promise<ArrayBuffer> {
  let pending = downloads.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`PDF ${response.status}`);
        return response.arrayBuffer();
      })
      .finally(() => downloads.delete(url));
    downloads.set(url, pending);
  }
  return pending;
}

/** Lets the browser paint and answer taps between two pages. */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type State = { url: string | null; pages: ShownPage[]; total: number | null; failed: boolean };

/**
 * The PDF at `url` (a Version, decrypted by the server), drawn page by page
 * in the browser with pdf.js. Pages arrive one after another; `total` is
 * known once the file is open.
 */
export function usePdfPages(url: string | null): { pages: ShownPage[]; total: number | null; failed: boolean } {
  const [state, setState] = useState<State>({ url: null, pages: [], total: null, failed: false });

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const urls: string[] = [];
    const update = (change: (current: State) => State) =>
      alive && setState((current) => change(current.url === url ? current : { url, pages: [], total: null, failed: false }));
    const width = drawWidth(window.innerWidth, window.devicePixelRatio || 1);

    (async () => {
      // The file and pdf.js arrive together, not one after the other.
      const [bytes, lib] = await Promise.all([download(url), loadPdfJs()]);
      // pdf.js takes its input over: a copy, so a shared download stays whole.
      const task = lib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
      try {
        const doc = await task.promise;
        update((current) => ({ ...current, total: doc.numPages }));
        for (let number = 1; number <= doc.numPages && alive; number++) {
          const page = await doc.getPage(number);
          const shown = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: width / shown.width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          page.cleanup();
          const src = URL.createObjectURL(await toJpeg(canvas));
          urls.push(src);
          update((current) => ({ ...current, pages: [...current.pages, { src, width: shown.width, height: shown.height }] }));
          await breathe();
        }
      } finally {
        await task.destroy();
      }
    })().catch(() => update((current) => ({ ...current, failed: true })));

    return () => {
      alive = false;
      urls.forEach((src) => URL.revokeObjectURL(src));
    };
  }, [url]);

  // Another file than the one drawn: nothing yet.
  if (state.url !== url) return { pages: [], total: null, failed: false };
  return state;
}
