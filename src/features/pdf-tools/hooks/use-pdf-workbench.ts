'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildPdf, compressPdf, compressToLimit, type RasterizePdf } from '@/features/pdf-tools/lib/build-pdf';
import {
  IRCC_MAX_BYTES,
  moved,
  rotated,
  withoutPage,
  withSource,
  type Page,
  type Source,
} from '@/features/pdf-tools/lib/pages';

/** How long after the last change the size is measured again. */
const MEASURE_DELAY_MS = 500;

export type CompressionStep = { quality: number; scale: number; size: number };

/**
 * The Outils PDF's state (#79): the files added and the pages, the output's
 * size measured shortly after each change, and a compressed copy that any
 * change throws away. `rasterize` redraws pages (pdf.js in the browser).
 */
export function usePdfWorkbench(rasterize: RasterizePdf) {
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  // Bumped by every change; the size measured belongs to one version.
  const [version, setVersion] = useState(0);
  const [measured, setMeasured] = useState<{ version: number; size: number | null }>({ version: 0, size: null });
  const [compressed, setCompressed] = useState<{ bytes: Uint8Array; quality: number } | null>(null);
  const [steps, setSteps] = useState<CompressionStep[]>([]);
  const [compressing, setCompressing] = useState(false);

  const change = useCallback((update: (pages: Page[]) => Page[]) => {
    setPages(update);
    setVersion((current) => current + 1);
    setCompressed(null);
    setSteps([]);
  }, []);

  const addSources = useCallback(
    (added: Source[]) => {
      setSources((current) => [...current, ...added]);
      change((current) => added.reduce(withSource, current));
    },
    [change],
  );

  // The size, measured again shortly after the last change.
  useEffect(() => {
    if (pages.length === 0) return;
    let current = true;
    const timer = setTimeout(() => {
      buildPdf(sources, pages)
        .then((bytes) => current && setMeasured({ version, size: bytes.byteLength }))
        .catch(() => current && setMeasured({ version, size: null }));
    }, MEASURE_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [sources, pages, version]);

  const size = pages.length === 0 ? null : measured.size;
  const measuring = pages.length > 0 && measured.version !== version;

  /** Lowers the quality step by step until the PDF fits IRCC's 4 Mo; rejects PDF_TOO_LARGE. */
  const compress = useCallback(async () => {
    setCompressing(true);
    setSteps([]);
    try {
      const lossless = await buildPdf(sources, pages);
      const result = await compressToLimit(
        (step) => compressPdf(lossless, step, rasterize),
        IRCC_MAX_BYTES,
        (step) => setSteps((current) => [...current, step]),
      );
      setCompressed({ bytes: result.bytes, quality: result.quality });
      return result;
    } finally {
      setCompressing(false);
    }
  }, [sources, pages, rasterize]);

  /** What leaves the tool: the compressed copy if there is one, else the pages as they are. */
  const output = useCallback(
    async (): Promise<Uint8Array> => compressed?.bytes ?? buildPdf(sources, pages),
    [compressed, sources, pages],
  );

  const sourceOf = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  return {
    sources,
    pages,
    sourceOf,
    size: compressed ? compressed.bytes.byteLength : size,
    measuring,
    compressed,
    steps,
    compressing,
    addSources,
    move: (id: string, to: number) => change((current) => moved(current, id, to)),
    rotate: (id: string, turn: 1 | -1) => change((current) => rotated(current, id, turn)),
    remove: (id: string) => change((current) => withoutPage(current, id)),
    compress,
    output,
  };
}
