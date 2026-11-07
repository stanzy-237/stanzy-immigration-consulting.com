'use client';

import { Eraser, FilePlus2, Minimize2, RotateCcw, RotateCw, Trash2, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useId, useRef, useState, type ChangeEvent, type HTMLAttributes, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import { usePdfWorkbench } from '@/features/pdf-tools/hooks/use-pdf-workbench';
import type { RasterizePdf } from '@/features/pdf-tools/lib/build-pdf';
import type { PdfChange } from '@/features/pdf-tools/lib/history-schema';
import { IRCC_MAX_BYTES, type Page, type Rotation, type Source } from '@/features/pdf-tools/lib/pages';

/** What the workbench runs on: the browser's pdf.js in the app, stubs in tests. */
export type WorkbenchEngine = {
  /** The `accept` of the file picker. */
  accepted: string;
  readSource: (file: Blob, name: string, id: string) => Promise<Source>;
  thumbnail: (source: Source, index: number, rotation: Rotation) => Promise<string>;
  rasterize: RasterizePdf;
};

/** What the result was made of, for the history. */
export type OutputMeta = {
  name: string;
  pageCount: number;
  changes: PdfChange[];
  quality: number | null;
  sourceNames: string[];
};

/** `releve-n2.pdf` from the first file added (`releve n2.jpg`), or the given fallback. */
export function defaultFileName(sources: Source[], fallback: string): string {
  const first = sources[0]?.name.replace(/\.[^.]+$/, '').trim();
  return first ? `${first}.pdf` : fallback;
}

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
  finish: { label: string; icon: LucideIcon; run: (pdf: Uint8Array, meta: OutputMeta) => Promise<void> };
  /** Files to start with (a Section's Documents). */
  initialSources?: Source[];
}): ReactNode {
  const t = useTranslations('PdfTools');
  const format = useFormatter();
  const ids = useId();
  const tool = usePdfWorkbench(engine.rasterize);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [name, setName] = useState('');
  const [clearing, setClearing] = useState(false);
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

  const fileName = (() => {
    const typed = name.trim();
    if (!typed) return defaultFileName(tool.sources, t('fileName'));
    return typed.toLowerCase().endsWith('.pdf') ? typed : `${typed}.pdf`;
  })();

  const done = async () => {
    setFinishing(true);
    try {
      await finish.run(await tool.output(), {
        name: fileName,
        pageCount: tool.pages.length,
        changes: tool.changes,
        quality: tool.compressed?.quality ?? null,
        sourceNames: tool.sources
          .filter((source) => tool.pages.some((page) => page.sourceId === source.id))
          .map((source) => source.name),
      });
    } finally {
      setFinishing(false);
    }
  };

  const fits = tool.size !== null && tool.size <= IRCC_MAX_BYTES;
  const FinishIcon = finish.icon;

  return (
    <div className="grid grid-cols-1 gap-5">
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
        <p className="min-w-0 flex-1 text-sm text-slate">{t('addHint')}</p>
        {tool.pages.length > 0 ? (
          <button
            type="button"
            onClick={() => setClearing(true)}
            className={`${button} text-slate hover:bg-off-white hover:text-rouge`}
          >
            <Eraser aria-hidden={true} className="size-4" />
            {t('clear')}
          </button>
        ) : null}
      </div>

      <AlertDialog open={clearing} onOpenChange={setClearing}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('clearTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('clearBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                tool.clear();
                setName('');
                setClearing(false);
              }}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson"
            >
              {t('clearConfirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tool.pages.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-slate">{t('empty')}</p>
      ) : (
        <SortablePages
          pages={tool.pages}
          sourceOf={tool.sourceOf}
          thumbnail={engine.thumbnail}
          onReorder={tool.reorder}
          onRotate={tool.rotate}
          onRemove={tool.remove}
        />
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
        <div className="w-full sm:w-56">
          <label htmlFor={`${ids}-name`} className="sr-only">
            {t('fileNameLabel')}
          </label>
          <input
            id={`${ids}-name`}
            value={name}
            maxLength={120}
            placeholder={defaultFileName(tool.sources, t('fileName'))}
            onChange={(event) => setName(event.target.value)}
            className="h-11 w-full rounded-full border-2 border-fog-light bg-white px-4 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
          />
        </div>
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
  source,
  thumbnail,
  handle,
  onRotate,
  onRemove,
}: {
  page: Page;
  number: number;
  source: Source;
  thumbnail: WorkbenchEngine['thumbnail'];
  /** What makes the thumbnail the drag handle (dnd-kit); none in the drag overlay. */
  handle?: HTMLAttributes<HTMLDivElement>;
  onRotate?: (turn: 1 | -1) => void;
  onRemove?: () => void;
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
      <div
        {...handle}
        aria-label={handle ? t('dragLabel', { number }) : undefined}
        className="flex aspect-3/4 cursor-grab touch-manipulation items-center justify-center overflow-hidden rounded-xl bg-off-white focus-visible:ring-2 focus-visible:ring-rouge focus-visible:outline-none active:cursor-grabbing"
      >
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
      {onRotate && onRemove ? (
        <div className="mt-1 flex items-center justify-center gap-2">
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
        </div>
      ) : null}
    </figure>
  );
}

/**
 * The pages, reordered by drag and drop (dnd-kit): the mouse after a few
 * pixels, a finger after a short press (so the page still scrolls), the
 * keyboard from the thumbnail (Espace to lift, the arrows, Espace to drop).
 * The page being dragged follows the pointer; the others make room.
 */
function SortablePages({
  pages,
  sourceOf,
  thumbnail,
  onReorder,
  onRotate,
  onRemove,
}: {
  pages: Page[];
  sourceOf: Map<string, Source>;
  thumbnail: WorkbenchEngine['thumbnail'];
  onReorder: (id: string, overId: string) => void;
  onRotate: (id: string, turn: 1 | -1) => void;
  onRemove: (id: string) => void;
}): ReactNode {
  const t = useTranslations('PdfTools');
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const numberOf = (id: UniqueIdentifier) => pages.findIndex((page) => page.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active: dragged }) => t('announce.start', { number: numberOf(dragged.id) }),
    onDragOver: ({ over }) => (over ? t('announce.over', { number: numberOf(over.id) }) : undefined),
    onDragEnd: ({ over }) => (over ? t('announce.end', { number: numberOf(over.id) }) : t('announce.cancel')),
    onDragCancel: () => t('announce.cancel'),
  };

  const end = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    if (over && dragged.id !== over.id) onReorder(String(dragged.id), String(over.id));
  };
  const dragged = active ? pages.find((page) => page.id === active) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('announce.instructions') } }}
      onDragStart={({ active: started }) => setActive(String(started.id))}
      onDragEnd={end}
      onDragCancel={() => setActive(null)}
    >
      <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
        <ol aria-label={t('pages')} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pages.map((page, index) => (
            <SortablePage
              key={page.id}
              page={page}
              number={index + 1}
              source={sourceOf.get(page.sourceId)!}
              thumbnail={thumbnail}
              onRotate={(turn) => onRotate(page.id, turn)}
              onRemove={() => onRemove(page.id)}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay>
        {dragged ? (
          <div className="rounded-2xl border border-navy-deep bg-white p-2 shadow-xl">
            <PageCard
              page={dragged}
              number={numberOf(dragged.id)}
              source={sourceOf.get(dragged.sourceId)!}
              thumbnail={thumbnail}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortablePage({
  page,
  number,
  source,
  thumbnail,
  onRotate,
  onRemove,
}: {
  page: Page;
  number: number;
  source: Source;
  thumbnail: WorkbenchEngine['thumbnail'];
  onRotate: (turn: 1 | -1) => void;
  onRemove: () => void;
}): ReactNode {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border bg-white p-2 shadow-sm ${isDragging ? 'border-dashed border-navy-deep opacity-40' : 'border-fog-light'}`}
    >
      <PageCard
        page={page}
        number={number}
        source={source}
        thumbnail={thumbnail}
        handle={{ ...attributes, ...listeners }}
        onRotate={onRotate}
        onRemove={onRemove}
      />
    </li>
  );
}
