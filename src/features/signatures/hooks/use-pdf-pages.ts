'use client';

import { useEffect, useState } from 'react';

import { loadPdfJs } from '@/features/pdf-tools/lib/browser-pdf';

/** One page drawn for reading: an image, and its shape as shown (rotation applied). */
export type ShownPage = { src: string; width: number; height: number };

/** How wide pages are drawn, in pixels: sharp enough to read a letter on a large screen. */
const DRAW_WIDTH = 1100;

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
    const update = (change: (current: State) => State) =>
      alive && setState((current) => change(current.url === url ? current : { url, pages: [], total: null, failed: false }));

    (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`PDF ${response.status}`);
      const lib = await loadPdfJs();
      const task = lib.getDocument({ data: new Uint8Array(await response.arrayBuffer()) });
      try {
        const doc = await task.promise;
        update((current) => ({ ...current, total: doc.numPages }));
        for (let number = 1; number <= doc.numPages && alive; number++) {
          const page = await doc.getPage(number);
          const shown = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: DRAW_WIDTH / shown.width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const drawn = { src: canvas.toDataURL('image/jpeg', 0.85), width: shown.width, height: shown.height };
          update((current) => ({ ...current, pages: [...current.pages, drawn] }));
          page.cleanup();
        }
      } finally {
        await task.destroy();
      }
    })().catch(() => update((current) => ({ ...current, failed: true })));

    return () => {
      alive = false;
    };
  }, [url]);

  // Another file than the one drawn: nothing yet.
  if (state.url !== url) return { pages: [], total: null, failed: false };
  return state;
}
