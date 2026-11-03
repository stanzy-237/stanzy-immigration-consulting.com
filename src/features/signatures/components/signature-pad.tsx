'use client';

import { Eraser } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

/** Ink colour: the brand's navy-deep. */
const INK = '#0D1F4E';
/** Space kept around the strokes when the signature is cut out. */
const MARGIN = 8;

type Bounds = { left: number; top: number; right: number; bottom: number };

/**
 * Where the Client draws their signature, with a mouse, a pen or a finger.
 * After each stroke, `onChange` gets the signature cut to its strokes as a
 * transparent PNG data URL; `null` once cleared.
 */
export function SignaturePad({
  onChange,
  describedBy,
}: {
  onChange: (png: string | null) => void;
  describedBy?: string;
}): ReactNode {
  const t = useTranslations('Signatures.sign');
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef<Bounds | null>(null);

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
    context.strokeStyle = INK;
    context.fillStyle = INK;
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const grow = ({ x, y }: { x: number; y: number }) => {
    const b = bounds.current;
    bounds.current = b
      ? { left: Math.min(b.left, x), top: Math.min(b.top, y), right: Math.max(b.right, x), bottom: Math.max(b.bottom, y) }
      : { left: x, top: y, right: x, bottom: y };
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = point(event);
    last.current = at;
    grow(at);
    const context = event.currentTarget.getContext('2d');
    // A dot, for a tap.
    context?.beginPath();
    context?.arc(at.x, at.y, 1.2, 0, Math.PI * 2);
    context?.fill();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = last.current;
    if (!from) return;
    const at = point(event);
    const context = event.currentTarget.getContext('2d');
    context?.beginPath();
    context?.moveTo(from.x, from.y);
    context?.lineTo(at.x, at.y);
    context?.stroke();
    last.current = at;
    grow(at);
  };
  const up = () => {
    if (!last.current) return;
    last.current = null;
    onChange(cutOut());
  };

  /** The strokes alone, with a small margin, as a PNG data URL. */
  const cutOut = (): string | null => {
    const element = canvas.current;
    const b = bounds.current;
    if (!element || !b) return null;
    const ratio = element.width / element.clientWidth;
    const left = Math.max(0, (b.left - MARGIN) * ratio);
    const top = Math.max(0, (b.top - MARGIN) * ratio);
    const width = Math.min(element.width - left, (b.right - b.left + MARGIN * 2) * ratio);
    const height = Math.min(element.height - top, (b.bottom - b.top + MARGIN * 2) * ratio);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(width));
    out.height = Math.max(1, Math.round(height));
    out.getContext('2d')?.drawImage(element, left, top, width, height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  const clear = () => {
    const element = canvas.current!;
    element.getContext('2d')?.clearRect(0, 0, element.width, element.height);
    bounds.current = null;
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
          className="h-44 w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-fog bg-white"
        />
        <span aria-hidden={true} className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-fog" />
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
