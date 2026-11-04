'use client';

import { Eraser } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

import { INKS, type Ink } from '@/features/signatures/lib/inks';

/** Space kept around the strokes when the signature is cut out. */
const MARGIN = 8;

type Point = { x: number; y: number };

/**
 * Where the Client draws their signature, with a mouse, a pen or a finger,
 * in `ink`. The strokes are kept, so changing the ink redraws them. After
 * each stroke, `onChange` gets the signature cut to its strokes as a
 * transparent PNG data URL; `null` once cleared.
 */
export function SignaturePad({
  ink,
  onChange,
  describedBy,
}: {
  ink: Ink;
  onChange: (png: string | null) => void;
  describedBy?: string;
}): ReactNode {
  const t = useTranslations('Signatures.sign');
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);

  /** Draws every stroke again in the current ink. */
  const redraw = () => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    context.clearRect(0, 0, element.clientWidth, element.clientHeight);
    context.strokeStyle = INKS[ink];
    context.fillStyle = INKS[ink];
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        // A dot, for a tap.
        context.beginPath();
        context.arc(stroke[0]!.x, stroke[0]!.y, 1.4, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.beginPath();
      context.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  };

  // Drawn at the screen's pixel density, so the signature stays sharp.
  useEffect(() => {
    const element = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(element.clientWidth * ratio);
    element.height = Math.round(element.clientHeight * ratio);
    const context = element.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.5;
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    strokes.current.push([point(event)]);
    redraw();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const stroke = strokes.current.at(-1)!;
    const from = stroke.at(-1)!;
    const to = point(event);
    stroke.push(to);
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    context.strokeStyle = INKS[ink];
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(cutOut());
  };

  /** The strokes alone, with a small margin, as a PNG data URL. */
  const cutOut = (): string | null => {
    const element = canvas.current;
    const points = strokes.current.flat();
    if (!element || points.length === 0) return null;
    const left = Math.min(...points.map((p) => p.x)) - MARGIN;
    const top = Math.min(...points.map((p) => p.y)) - MARGIN;
    const right = Math.max(...points.map((p) => p.x)) + MARGIN;
    const bottom = Math.max(...points.map((p) => p.y)) + MARGIN;
    const ratio = element.width / element.clientWidth;
    const sx = Math.max(0, left * ratio);
    const sy = Math.max(0, top * ratio);
    const width = Math.min(element.width - sx, (right - left) * ratio);
    const height = Math.min(element.height - sy, (bottom - top) * ratio);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(width));
    out.height = Math.max(1, Math.round(height));
    out.getContext('2d')?.drawImage(element, sx, sy, width, height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  // Another ink: the same strokes, in it.
  useEffect(() => {
    redraw();
    if (strokes.current.length > 0) onChange(cutOut());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the ink changes
  }, [ink]);

  const clear = () => {
    strokes.current = [];
    redraw();
    onChange(null);
  };

  return (
    <div className="grid gap-2">
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label={t('padLabel')}
          aria-describedby={describedBy}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="h-48 w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-fog bg-white"
        />
        <span aria-hidden={true} className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-fog" />
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate hover:text-navy-deep"
      >
        <Eraser aria-hidden={true} className="size-4" />
        {t('clear')}
      </button>
    </div>
  );
}
