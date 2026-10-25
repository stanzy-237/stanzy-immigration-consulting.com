"use client";

import { useNow, useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { DaysSince } from "@/features/parcours/components/days-since";
import {
  ETAPE_EMOJIS,
  ETAPE_PRESETS,
  type EtapePreset,
} from "@/features/parcours/data/etapes";
import { ETAPE_COLORS } from "@/features/parcours/data/palette";
import { daysSince, todayOf } from "@/features/parcours/lib/calendar-day";
import { codeFromLabel } from "@/features/parcours/lib/etape-code";
import { colorClasses } from "@/features/parcours/lib/etape-color";
import type { Etape, EtapeInput } from "@/features/parcours/lib/etape-schema";
import { cn } from "@/lib/utils";

type Draft = {
  emoji: EtapeInput["emoji"];
  label: string;
  /** Set by a preset; a hand-typed label clears it so the server derives one. */
  code: string;
  color: EtapeInput["color"];
  date: string;
  note: string;
};

const BLANK: Draft = {
  emoji: "✈️",
  label: "",
  code: "",
  color: "slate",
  date: "",
  note: "",
};

const draftOf = (etape: Etape | null): Draft =>
  etape
    ? {
        emoji: etape.emoji as Draft["emoji"],
        label: etape.label,
        code: etape.code,
        color: etape.color as Draft["color"],
        date: etape.date,
        note: etape.note,
      }
    : BLANK;

/** Exactly two rows of 40px buttons (2 × 40 + 8 gap + 4 padding); the rest scrolls. */
const scrollBox = "max-h-23 overflow-y-auto overscroll-contain p-0.5 pr-1";

const fieldLabel =
  "mb-2 block font-label font-semibold uppercase tracking-widest text-slate";
const input =
  "w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-body text-navy-deep outline-none transition focus:border-rouge focus:ring-4 focus:ring-rouge/10";

/**
 * Adds or edits one Étape. The same form sits in the desktop sidebar and the
 * phone drawer; remount it (with a `key`) to start over.
 */
export function EtapeForm({
  etape,
  pending,
  error,
  onSubmit,
  onDelete,
}: {
  /** The Étape being edited, or null to add one. */
  etape: Etape | null;
  pending: boolean;
  /** A message to show when saving failed; the draft is kept. */
  error?: string;
  onSubmit: (input: EtapeInput) => void;
  onDelete?: () => void;
}): ReactNode {
  const t = useTranslations("Parcours");
  const id = useId();
  const now = useNow();
  const [draft, setDraft] = useState<Draft>(() => draftOf(etape));
  const [problems, setProblems] = useState<{ label?: string; date?: string }>(
    {},
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const presetLabel = (preset: EtapePreset) => t(`Presets.${preset.labelKey}`);
  const pick = (preset: EtapePreset) =>
    set({
      code: preset.code,
      label: presetLabel(preset),
      emoji: preset.emoji,
      color: preset.color,
    });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = {
      ...(draft.label.trim() ? {} : { label: t("form.errors.label") }),
      ...(!draft.date
        ? { date: t("form.errors.date") }
        : draft.date > todayOf(now)
          ? { date: t("form.errors.future") }
          : {}),
    };
    setProblems(found);
    if (found.label || found.date) return;
    onSubmit({
      label: draft.label.trim(),
      ...(draft.code ? { code: draft.code } : {}),
      emoji: draft.emoji,
      color: draft.color,
      date: draft.date,
      note: draft.note.trim(),
    });
  };

  const previewCode =
    draft.code || (draft.label.trim() ? codeFromLabel(draft.label) : "ETAPE");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className={fieldLabel}>{t("form.icon")}</legend>
        <div className={cn("flex flex-wrap gap-2", scrollBox)}>
          {ETAPE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={t("form.chooseIcon", { emoji })}
              aria-pressed={draft.emoji === emoji}
              onClick={() => set({ emoji })}
              className={cn(
                "grid size-10 place-items-center rounded-xl border-2 border-fog-light bg-white text-xl",
                draft.emoji === emoji && "border-rouge bg-blush",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>{t("form.presets")}</legend>
        <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-3", scrollBox)}>
          {ETAPE_PRESETS.map((preset) => (
            <button
              key={preset.code}
              type="button"
              title={presetLabel(preset)}
              aria-pressed={draft.code === preset.code}
              onClick={() => pick(preset)}
              className={cn(
                "flex h-10 min-w-0 items-center gap-2 rounded-lg border-2 border-fog-light bg-white px-3 text-left",
                draft.code === preset.code && "border-navy-deep bg-ice-blue",
              )}
            >
              <span
                aria-hidden={true}
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  colorClasses(preset.color).solid,
                )}
              />
              <span className="truncate text-caption font-medium text-navy-deep">
                {preset.code}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <p className="flex items-center gap-2.5 font-label uppercase tracking-wider text-steel-blue before:h-px before:flex-1 before:bg-fog-light after:h-px after:flex-1 after:bg-fog-light">
        {t("form.manual")}
      </p>

      <div>
        <label htmlFor={`${id}-label`} className={fieldLabel}>
          {t("form.label")}
        </label>
        <input
          id={`${id}-label`}
          type="text"
          maxLength={80}
          value={draft.label}
          onChange={(e) => set({ label: e.target.value, code: "" })}
          placeholder={t("form.labelPlaceholder")}
          aria-invalid={problems.label ? true : undefined}
          aria-describedby={problems.label ? `${id}-label-error` : undefined}
          className={cn(input, "h-12")}
        />
        {problems.label && (
          <p
            id={`${id}-label-error`}
            className="mt-1.5 text-caption text-crimson"
          >
            {problems.label}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-date`} className={fieldLabel}>
          {t("form.date")}
        </label>
        <input
          id={`${id}-date`}
          type="date"
          max={todayOf(now)}
          value={draft.date}
          onChange={(e) => set({ date: e.target.value })}
          aria-invalid={problems.date ? true : undefined}
          aria-describedby={problems.date ? `${id}-date-error` : undefined}
          className={cn(input, "h-12")}
        />
        {problems.date && (
          <p
            id={`${id}-date-error`}
            className="mt-1.5 text-caption text-crimson"
          >
            {problems.date}
          </p>
        )}
        {draft.date && (
          <DaysSince
            days={daysSince(draft.date, now)}
            code={previewCode}
            borderClass={colorClasses(draft.color).border}
            className="mt-2"
          />
        )}
      </div>

      <fieldset>
        <legend className={fieldLabel}>{t("form.color")}</legend>
        <div className="flex flex-wrap items-center gap-2.5 py-0.5">
          {ETAPE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={t(`colors.${color}`)}
              aria-pressed={draft.color === color}
              onClick={() => set({ color })}
              className={cn(
                "size-7 rounded-full",
                colorClasses(color).solid,
                draft.color === color &&
                  cn("ring-2 ring-offset-2", colorClasses(color).ring),
              )}
            />
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-note`} className={fieldLabel}>
          {t("form.note")}
        </label>
        <textarea
          id={`${id}-note`}
          maxLength={500}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder={t("form.notePlaceholder")}
          className={cn(input, "min-h-20 resize-y py-3")}
        />
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-crimson">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-13 w-full rounded-2xl bg-rouge font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-60"
      >
        {etape ? t("form.submitEdit") : t("form.submitAdd")}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="h-11 w-full rounded-2xl border-2 border-rose bg-transparent text-body-sm font-semibold text-rouge"
        >
          {t("form.delete")}
        </button>
      )}
    </form>
  );
}
