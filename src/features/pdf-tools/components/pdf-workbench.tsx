'use client';

import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { usePdfWorkbench } from '@/features/pdf-tools/hooks/use-pdf-workbench';
import type { RasterizePdf } from '@/features/pdf-tools/lib/build-pdf';
import { IRCC_MAX_BYTES, type Page, type Rotation, type Source } from '@/features/pdf-tools/lib/pages';

/** What the workbench runs on: the browser's pdf.js in the app, stubs in tests. */
export type WorkbenchEngine = {
  /** The `accept` of the file picker. */
  accepted: string;
  readSource: (file: Blob, name: string, id: string) => Promise<Source>;
  thumbnail: (source: Source, index: number, rotation: Rotation) => Promise<string>;
  rasterize: RasterizePdf;
};

const button =
  'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const iconButton =
  'inline-flex size-8 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-navy-deep disabled:opacity-30';

let sourceCount = 0;

/**
 * The Outils PDF (#79), iLovePDF-style, all in the browser: add PDFs and
 * photos, reorder (arrows or drag), rotate and delete pages, read the size,
 * « Compresser jusqu'à 4 Mo », then `finish` with the result (download, or
 * save as a Section's Fichier de soumission). Splitting, OCR and cropping
 * are out of scope.
 */
export function PdfWorkbench({
  engine,
  finish,
  initialSources,
}: {
  engine: WorkbenchEngine;
  finish: { label: string; icon: LucideIcon; run: (pdf: Uint8Array) => Promise<void> };
  /** Files to start with (a Section's Documents). */
  initialSources?: Source[];
}): ReactNode {
  const t = useTranslations('PdfTools');
  const format = useFormatter();
  const ids = useId();
  const tool = usePdfWorkbench(engine.rasterize);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (initialSources && initialSources.length > 0 && !started.current) {
      started.current = true;
      tool.addSources(initialSources);
    }
  }, [initialSources, tool]);

  const mo = (bytes: number) => t('size', { size: format.number(bytes / 1024 / 1024, { maximumFractionDigits: 1 }) });

  const add = async (files: FileList | File[]) => {
    setAdding(true);
    const added: Source[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await engine.readSource(file, file.name, `s${++sourceCount}`));
      } catch (error) {
        const reason = error instanceof Error && error.message === 'PDF_UNSUPPORTED' ? 'unsupported' : 'unreadable';
        toast.add({ title: t(`errors.${reason}`, { name: file.name }), type: 'warning' });
      }
    }
    if (added.length > 0) tool.addSources(added);
    setAdding(false);
  };

  const compress = async () => {
    try {
      const result = await tool.compress();
      toast.add({ title: t('toast.compressed', { size: mo(result.bytes.byteLength) }), type: 'success' });
    } catch (error) {
      const size = (error as { size?: number }).size;
      toast.add({ title: size ? t('errors.tooLarge', { size: mo(size) }) : t('errors.failed'), type: 'error' });
    }
  };

  const done = async () => {
    setFinishing(true);
    try {
      await finish.run(await tool.output());
    } finally {
      setFinishing(false);
    }
  };

  const drop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragged) tool.move(dragged, index);
    setDragged(null);
  };

  const fits = tool.size !== null && tool.size <= IRCC_MAX_BYTES;
  const FinishIcon = finish.icon;

  return (
    <div className="grid gap-5">
      <div
        onDragOver={(event) => event.dataTransfer.types.includes('Files') && event.preventDefault()}
        onDrop={(event) => {
          if (event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          void add(event.dataTransfer.files);
        }}
        className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-fog-light bg-white p-5"
      >
        <input
          id={ids}
          type="file"
          multiple
          accept={engine.accepted}
          className="peer sr-only"
          disabled={adding}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) void add(event.target.files);
            event.target.value = '';
          }}
        />
        <label
          htmlFor={ids}
          className={`${button} cursor-pointer bg-navy-deep text-white hover:bg-navy-80 peer-focus-visible:ring-2 peer-focus-visible:ring-rouge`}
        >
          <FilePlus2 aria-hidden={true} className="size-4" />
          {adding ? t('adding') : t('add')}
        </label>
        <p className="text-sm text-slate">{t('addHint')}</p>
      </div>

      {tool.pages.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-slate">{t('empty')}</p>
      ) : (
        <ol aria-label={t('pages')} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tool.pages.map((page, index) => (
            <li
              key={page.id}
              draggable
              onDragStart={() => setDragged(page.id)}
              onDragOver={(event) => dragged && event.preventDefault()}
              onDrop={(event) => drop(event, index)}
              className={`rounded-2xl border bg-white p-2 shadow-sm ${dragged === page.id ? 'border-navy-deep opacity-50' : 'border-fog-light'}`}
            >
              <PageCard
                page={page}
                number={index + 1}
                count={tool.pages.length}
                source={tool.sourceOf.get(page.sourceId)!}
                thumbnail={engine.thumbnail}
                onMove={(to) => tool.move(page.id, to)}
                onRotate={(turn) => tool.rotate(page.id, turn)}
                onRemove={() => tool.remove(page.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-fog-light bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-semibold text-navy-deep">
            {t('pageCount', { count: tool.pages.length })}
            {tool.size !== null ? ` · ${mo(tool.size)}` : null}
            {tool.measuring && !tool.compressed ? ` · ${t('measuring')}` : null}
          </p>
          {tool.size !== null ? (
            <p className={fits ? 'text-sm text-leaf' : 'text-sm text-rouge'}>{fits ? t('fits') : t('tooBig')}</p>
          ) : null}
          {tool.compressed ? (
            <p className="text-xs text-slate">
              {t('compressedNote', { quality: Math.round(tool.compressed.quality * 100) })}
            </p>
          ) : null}
          {tool.compressing && tool.steps.length > 0 ? (
            <p className="text-xs text-slate">
              {t('trying', {
                quality: Math.round(tool.steps.at(-1)!.quality * 100),
                size: mo(tool.steps.at(-1)!.size),
              })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={tool.pages.length === 0 || tool.compressing || tool.compressed !== null}
          onClick={() => void compress()}
          className={`${button} border-2 border-navy-deep text-navy-deep hover:bg-navy-deep hover:text-white`}
        >
          <Minimize2 aria-hidden={true} className="size-4" />
          {tool.compressing ? t('compressing') : t('compress')}
        </button>
        <button
          type="button"
          disabled={tool.pages.length === 0 || finishing || tool.compressing}
          onClick={() => void done()}
          className={`${button} bg-rouge text-white hover:bg-crimson`}
        >
          <FinishIcon aria-hidden={true} className="size-4" />
          {finish.label}
        </button>
      </div>
    </div>
  );
}

/** One output page: its thumbnail, number and source, and what can be done to it. */
function PageCard({
  page,
  number,
  count,
  source,
  thumbnail,
  onMove,
  onRotate,
  onRemove,
}: {
  page: Page;
  number: number;
  count: number;
  source: Source;
  thumbnail: WorkbenchEngine['thumbnail'];
  onMove: (to: number) => void;
  onRotate: (turn: 1 | -1) => void;
  onRemove: () => void;
}): ReactNode {
  const t = useTranslations('PdfTools');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    thumbnail(source, page.index, page.rotation)
      .then((url) => current && setSrc(url))
      .catch(() => current && setSrc(null));
    return () => {
      current = false;
    };
  }, [thumbnail, source, page.index, page.rotation]);

  // A photo's thumbnail is the photo itself: turn it as the page will be.
  const turn = source.kind === 'image' ? ['', 'rotate-90', 'rotate-180', '-rotate-90'][page.rotation / 90] : '';
  const label = t('pageLabel', { number, name: source.name });

  return (
    <figure>
      <div className="flex aspect-3/4 items-center justify-center overflow-hidden rounded-xl bg-off-white">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data/blob URL, not an optimisable asset
          <img src={src} alt={label} className={`max-h-full max-w-full object-contain ${turn}`} />
        ) : (
          <span className="text-xs text-slate-mute">{t('rendering')}</span>
        )}
      </div>
      <figcaption className="mt-1.5 truncate text-xs text-slate">
        <span className="font-semibold text-navy-deep">{number}</span> · {source.name}
      </figcaption>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          disabled={number === 1}
          onClick={() => onMove(number - 2)}
          className={iconButton}
          aria-label={t('moveEarlier', { number })}
        >
          <ChevronLeft aria-hidden={true} className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onRotate(-1)}
          className={iconButton}
          aria-label={t('rotateLeft', { number })}
        >
          <RotateCcw aria-hidden={true} className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onRotate(1)}
          className={iconButton}
          aria-label={t('rotateRight', { number })}
        >
          <RotateCw aria-hidden={true} className="size-4" />
        </button>
        <button type="button" onClick={onRemove} className={iconButton} aria-label={t('remove', { number })}>
          <Trash2 aria-hidden={true} className="size-4" />
        </button>
        <button
          type="button"
          disabled={number === count}
          onClick={() => onMove(number)}
          className={iconButton}
          aria-label={t('moveLater', { number })}
        >
          <ChevronRight aria-hidden={true} className="size-4" />
        </button>
      </div>
    </figure>
  );
}
