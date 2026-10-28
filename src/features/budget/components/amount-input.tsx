"use client";

import { useFormatter } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { parseAmount } from "@/features/budget/lib/money";

/**
 * A number the User can retype freely: what they type stays while they edit,
 * and every readable value is passed on at once.
 */
export function AmountInput({
  label,
  value,
  onChange,
  hint,
  className = "",
  fieldClassName = "",
  after,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  className?: string;
  /** Sizes the input (with `after`) without narrowing the label above it. */
  fieldClassName?: string;
  /** Shown beside the input, e.g. a reset button. */
  after?: ReactNode;
}): ReactNode {
  const id = useId();
  const format = useFormatter();
  /** The text being typed; null shows `value`. */
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft ??
    format.number(value, { useGrouping: false, maximumFractionDigits: 4 });

  return (
    <div className={className}>
      {/* One line on desktop; more air on phones, where it wraps. */}
      <label
        htmlFor={id}
        className="mb-2 block font-label leading-relaxed text-slate lg:mb-1.5 lg:whitespace-nowrap"
      >
        {label}
      </label>
      <div className={`flex items-center gap-2 ${fieldClassName}`}>
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
          className="h-11 w-full min-w-0 rounded-xl border border-fog bg-white px-3.5 text-body text-navy-deep outline-none transition-colors hover:border-slate-mute focus-visible:border-rouge focus-visible:ring-2 focus-visible:ring-rouge/20"
        />
        {after}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
