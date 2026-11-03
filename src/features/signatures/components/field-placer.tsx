'use client';

import { CalendarDays, PenLine, Stamp, Type, X, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { fieldStyle, PdfPages } from '@/features/signatures/components/pdf-pages';
import {
  FIELD_KINDS,
  FIELD_SIZES,
  type FieldKind,
  type SignatureField,
} from '@/features/signatures/lib/signature-schema';

export type PlacedField = SignatureField & { key: string };

const ICONS: Record<FieldKind, LucideIcon> = { SIGNATURE: PenLine, NAME: Type, DATE: CalendarDays, STAMP: Stamp };

/** Each kind's frame: the Client's in red, the consultant's stamp in navy. */
export const FIELD_COLORS: Record<FieldKind, string> = {
  SIGNATURE: 'border-rouge bg-rouge/10 text-rouge',
  NAME: 'border-rouge bg-rouge/10 text-rouge',
  DATE: 'border-rouge bg-rouge/10 text-rouge',
  STAMP: 'border-navy-deep bg-navy-deep/10 text-navy-deep',
};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));

/** `field` moved by (dx, dy) fractions of its page, kept inside it. */
const moved = (field: PlacedField, dx: number, dy: number): PlacedField => ({
  ...field,
  x: clamp(field.x + dx, 1 - field.width),
  y: clamp(field.y + dy, 1 - field.height),
});

/**
 * The consultant places the fields on the PDF (#96): pick a kind, tap the
 * page where it goes (centred on the tap); drag a field, or focus it and
 * use the arrow keys, to move it; its × removes it.
 */
export function FieldPlacer({
  url,
  fields,
  onChange,
  tool,
  onTool,
  stampReady,
}: {
  url: string;
  fields: PlacedField[];
  onChange: (fields: PlacedField[]) => void;
  tool: FieldKind;
  onTool: (kind: FieldKind) => void;
  /** Whether the consultant's signature and the stamp are uploaded. */
  stampReady: boolean;
}): ReactNode {
  const t = useTranslations('Signatures');
  const counter = useRef(0);

  const place = (page: number, x: number, y: number) => {
    const size = FIELD_SIZES[tool];
    counter.current += 1;
    const field: PlacedField = {
      key: `field-${counter.current}`,
      kind: tool,
      page,
      x: clamp(x - size.width / 2, 1 - size.width),
      y: clamp(y - size.height / 2, 1 - size.height),
      ...size,
    };
    onChange([...fields, field]);
  };
  const update = (key: string, change: (field: PlacedField) => PlacedField) =>
    onChange(fields.map((field) => (field.key === key ? change(field) : field)));

  return (
    <div className="grid gap-4">
      <div className="sticky top-16 z-20 grid gap-2 rounded-2xl border border-fog-light bg-white/95 p-3 shadow-sm backdrop-blur">
        <div role="group" aria-label={t('new.place.tools')} className="flex flex-wrap gap-2">
          {FIELD_KINDS.map((kind) => {
            const Icon = ICONS[kind];
            const disabled = kind === 'STAMP' && !stampReady;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={tool === kind}
                disabled={disabled}
                onClick={() => onTool(kind)}
                className={
                  tool === kind
                    ? 'inline-flex h-10 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white'
                    : 'inline-flex h-10 items-center gap-1.5 rounded-full border border-fog-light px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50'
                }
              >
                <Icon aria-hidden={true} className="size-4" />
                {t(`fields.${kind}`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate">
          {stampReady ? t('new.place.hint') : `${t('new.place.hint')} ${t('new.place.needAssets')}`}
        </p>
        <p className="text-xs font-semibold text-navy-deep" aria-live="polite">
          {t('new.place.count', { count: fields.length })}
        </p>
      </div>

      <PdfPages
        url={url}
        onPlace={place}
        placeLabel={(number) => `${t(`fields.${tool}`)} · ${t('new.place.page', { number })}`}
        overlay={(page) =>
          fields
            .filter((field) => field.page === page)
            .map((field) => (
              <PlacedBox
                key={field.key}
                field={field}
                onMove={(dx, dy) => update(field.key, (current) => moved(current, dx, dy))}
                onRemove={() => onChange(fields.filter((other) => other.key !== field.key))}
              />
            ))
        }
      />
    </div>
  );
}

function PlacedBox({
  field,
  onMove,
  onRemove,
}: {
  field: PlacedField;
  onMove: (dx: number, dy: number) => void;
  onRemove: () => void;
}): ReactNode {
  const t = useTranslations('Signatures');
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const label = t(`fields.${field.kind}`);
  const Icon = ICONS[field.kind];

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const page = event.currentTarget.parentElement!.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, width: page.width, height: page.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from) return;
    onMove((event.clientX - from.x) / from.width, (event.clientY - from.y) / from.height);
    drag.current = { ...from, x: event.clientX, y: event.clientY };
  };
  const end = () => {
    drag.current = null;
  };
  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[event.key];
    if (by) {
      event.preventDefault();
      onMove(...by);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove();
    }
  };

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={label}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={nudge}
      className={`absolute flex cursor-move touch-none items-center gap-1 rounded-md border-2 border-dashed px-1.5 text-xs font-semibold select-none focus-visible:outline-2 focus-visible:outline-navy-deep ${FIELD_COLORS[field.kind]}`}
      style={fieldStyle(field)}
    >
      <Icon aria-hidden={true} className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('new.place.remove', { field: label })}
        className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-navy-deep shadow-sm hover:text-rouge"
      >
        <X aria-hidden={true} className="size-3.5" />
      </button>
    </div>
  );
}
