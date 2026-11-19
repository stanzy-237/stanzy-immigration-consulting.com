// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { drawWidth, usePdfPages } from '@/features/shared/hooks/use-pdf-pages';

/** Seam: pdf.js (loadPdfJs) and the browser's canvas, as a two-page A4 Contrat (#165). */
const pdf = vi.hoisted(() => ({ scales: [] as number[] }));
vi.mock('@/features/pdf-tools/lib/browser-pdf', () => ({
  loadPdfJs: async () => ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async () => ({
          getViewport: ({ scale }: { scale: number }) => {
            if (scale !== 1) pdf.scales.push(scale);
            return { width: 595 * scale, height: 842 * scale };
          },
          render: () => ({ promise: Promise.resolve() }),
          cleanup: () => {},
        }),
      }),
      destroy: async () => {},
    }),
  }),
}));

let next = 0;
beforeEach(() => {
  pdf.scales = [];
  next = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: () => {} } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['jpeg'])));
  URL.createObjectURL = vi.fn(() => `blob:page-${++next}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('drawWidth', () => {
  it('draws for the screen at up to twice its density, never wider than a desktop needs', () => {
    expect(drawWidth(390, 3)).toBe(780); // a phone: about half a desktop's pixels
    expect(drawWidth(390, 1)).toBe(390);
    expect(drawWidth(1440, 2)).toBe(1100);
    expect(drawWidth(800, 0)).toBe(800);
  });
});

describe('usePdfPages', () => {
  it('draws each page at the phone’s width as a blob URL, and frees them when the page closes', async () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('devicePixelRatio', 3);
    const { result, unmount } = renderHook(() => usePdfPages('/api/contracts/c_1/pdf'));

    await waitFor(() => expect(result.current.pages).toHaveLength(2));
    expect(result.current.total).toBe(2);
    expect(result.current.pages.map((page) => page.src)).toEqual(['blob:page-1', 'blob:page-2']);
    expect(pdf.scales.every((scale) => Math.round(595 * scale) === 780)).toBe(true);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-2');
  });

  it('says so when the file can’t be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    const { result } = renderHook(() => usePdfPages('/api/contracts/c_1/pdf'));
    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
