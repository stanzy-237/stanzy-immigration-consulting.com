import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The calculator's form controls: a label above, an optional hint or error below. */
const CONTROL =
  'h-12 w-full rounded-xl border border-fog bg-white px-4 font-body text-body text-navy-deep outline-none transition-colors hover:border-slate-mute focus-visible:border-rouge focus-visible:ring-2 focus-visible:ring-rouge/20 aria-invalid:border-rouge';

const LABEL = 'mb-2 block font-label text-slate';

function Described({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: ReactNode;
  error?: ReactNode;
}): ReactNode {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-2 text-body-sm font-medium text-rouge">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="mt-2 text-body-sm text-slate">
      {hint}
    </p>
  ) : null;
}

const describedBy = (id: string, hint?: ReactNode, error?: ReactNode): string | undefined =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  error?: ReactNode;
}): ReactNode {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <span className="relative block">
        <select
          id={id}
          className={cn(CONTROL, 'appearance-none pr-10')}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden={true}
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate"
        />
      </span>
      <Described id={id} hint={hint} error={error} />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  inputMode = 'decimal',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
  inputMode?: 'decimal' | 'numeric';
}): ReactNode {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={inputMode === 'numeric' ? 'number' : 'text'}
        inputMode={inputMode}
        className={CONTROL}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onChange(e.target.value)}
      />
      <Described id={id} hint={hint} error={error} />
    </div>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  points,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  points?: string;
  /** Shown but set by another answer (e.g. counted automatically). */
  disabled?: boolean;
}): ReactNode {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-body-sm font-semibold text-navy-deep transition-colors',
        checked ? 'border-navy-deep bg-ice-blue' : 'border-fog hover:border-slate-mute',
        disabled && 'cursor-default opacity-80',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-navy-deep"
      />
      <span className="flex-1">{label}</span>
      {points ? <strong className="text-rouge">{points}</strong> : null}
    </label>
  );
}

/**
 * One card of a calculator, named by its heading, with the points it earns.
 * `step` ("Étape 01") and `subtitle` sit around the heading; `accent` adds a
 * coloured top bar.
 */
export function CalculatorSection({
  id,
  title,
  points,
  accent,
  step,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  points?: string;
  accent?: 'rouge' | 'navy' | 'steel';
  step?: string;
  subtitle?: string;
  children: ReactNode;
}): ReactNode {
  const headingId = `calculator-${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6"
    >
      {accent ? (
        <div
          aria-hidden={true}
          className={cn(
            'absolute inset-x-0 top-0 h-1',
            accent === 'rouge' ? 'bg-rouge' : accent === 'navy' ? 'bg-navy-deep' : 'bg-steel-blue',
          )}
        />
      ) : null}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          {step ? <p className="mb-2 font-label text-rouge">{step}</p> : null}
          <h2 id={headingId} className="font-heading text-h4 font-bold text-navy-deep">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-body-sm text-slate">{subtitle}</p> : null}
        </div>
        {points !== undefined ? (
          <span
            data-testid="section-points"
            className="shrink-0 rounded-full bg-ice-blue px-2.5 py-0.5 font-label text-navy-deep"
          >
            {points}
          </span>
        ) : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
