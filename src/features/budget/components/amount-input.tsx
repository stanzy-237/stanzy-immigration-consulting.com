'use client';

import { useFormatter } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { parseAmount } from '@/features/budget/lib/money';

/**
 * A number the User can retype freely: what they type stays while they edit,
 * and every readable value is passed on at once.
 */
export function AmountInput({
  label,
  value,
  onChange,
  hint,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  className?: string;
}): ReactNode {
  const id = useId();
  const format = useFormatter();
  /** The text being typed; null shows `value`. */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format.number(value, { useGrouping: false, maximumFractionDigits: 4 });

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block font-label text-slate">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={shown}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseAmount(e.target.value);
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => setDraft(null)}
        className="h-11 w-full rounded-xl border border-fog bg-white px-3.5 text-body text-navy-deep outline-none transition-colors hover:border-slate-mute focus-visible:border-rouge focus-visible:ring-2 focus-visible:ring-rouge/20"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
