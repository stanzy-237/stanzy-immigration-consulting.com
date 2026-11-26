"use client";

import { ChevronRight, Plus, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addSlot,
  DAY_END,
  firstFreeStart,
  isOpenAt,
  minutesOf,
  resizeSlot,
  setSlot,
  shortHour,
  shortRanges,
  TIME_OPTIONS,
  clockOf,
  type DayRange,
} from "@/features/consultation/lib/day-ranges";
import { PRESS } from "@/features/consultation/lib/styles";
import { cn } from "@/lib/utils";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** What the week's hours are read from and written to (the Disponibilités draft). */
export type HoursSource = {
  ranges: (day: number) => DayRange[];
  setRanges: (day: number, ranges: DayRange[]) => void;
  /** Writes these days and saves everything at once (the phone's day sheet). */
  saveDays: (days: Record<number, DayRange[]>) => void;
};

function useDayName() {
  const format = useFormatter();
  return (day: number, width: "short" | "long") =>
    format
      .dateTime(new Date(Date.UTC(2026, 10, 22 + day)), {
        weekday: width,
        timeZone: "UTC",
      })
      .replace(".", "");
}

/**
 * « Horaires de la semaine » (`Consultations · 3 Disponibilités`): on
 * desktop, a timeline per day: hover a gap for « + Ajouter », drag an edge
 * to lengthen, click a slot for exact hours. On phones, one line per day
 * (« 9h–13h · 18h–22h ») that opens the day's sheet.
 */
export function WeekHours({ source }: { source: HoursSource }): ReactNode {
  return (
    <>
      <WeekTimeline source={source} />
      <DayList source={source} />
    </>
  );
}

function WeekTimeline({ source }: { source: HoursSource }): ReactNode {
  const t = useTranslations("Consultation.admin.availability");
  const all = DAYS.flatMap((day) => source.ranges(day));
  const from = Math.min(
    8,
    ...all.map((r) => Math.floor(minutesOf(r.start) / 60)),
  );
  const to = Math.max(22, ...all.map((r) => Math.ceil(minutesOf(r.end) / 60)));
  const marks = Array.from(
    { length: Math.floor((to - from) / 2) + 1 },
    (_, i) => from + i * 2,
  );
  const pct = (minutes: number) =>
    ((minutes - from * 60) / ((to - from) * 60)) * 100;
  const weekly =
    all.reduce((sum, r) => sum + minutesOf(r.end) - minutesOf(r.start), 0) / 60;

  return (
    <div className="hidden flex-col gap-1.5 md:flex">
      <div aria-hidden={true} className="flex items-center gap-4">
        <span className="w-12 shrink-0" />
        <span className="relative h-4 flex-1">
          {marks.map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 text-label text-slate-mute"
              style={{ left: `${pct(hour * 60)}%` }}
            >
              {hour}h
            </span>
          ))}
        </span>
        <span className="w-40 shrink-0" />
        <span className="w-9 shrink-0" />
      </div>
      {DAYS.map((day) => (
        <DayTimeline
          key={day}
          day={day}
          source={source}
          from={from}
          to={to}
          pct={pct}
        />
      ))}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-fog-light pt-3 text-caption text-slate">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {t.rich("helpHover", {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </span>
          <span>
            {t.rich("helpDrag", {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </span>
          <span>
            {t.rich("helpClick", {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </span>
        </span>
        <span className="font-bold text-ink">
          {t("weeklyTotal", { hours: Math.round(weekly * 10) / 10 })}
        </span>
      </div>
    </div>
  );
}

type DayProps = {
  day: number;
  source: HoursSource;
  from: number;
  to: number;
  pct: (minutes: number) => number;
};

function DayTimeline({ day, source, from, to, pct }: DayProps): ReactNode {
  const t = useTranslations("Consultation.admin.availability");
  const dayName = useDayName();
  const ranges = source.ranges(day);
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const closed = ranges.length === 0;

  const minutesAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return from * 60 + ratio * (to - from) * 60;
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== track.current) return setHover(null);
    const hour = Math.floor(minutesAt(event.clientX) / 60) * 60;
    setHover(
      !isOpenAt(ranges, hour) && addSlot(ranges, day, hour) !== ranges
        ? hour
        : null,
    );
  };
  const add = (start: number) => {
    source.setRanges(day, addSlot(ranges, day, start));
    setHover(null);
  };
  const ghostEnd =
    hover === null
      ? 0
      : Math.min(
          hover + 60,
          DAY_END,
          ...ranges.map((r) => minutesOf(r.start)).filter((m) => m > hover),
        );
  const free = firstFreeStart(ranges);

  return (
    <div className="flex items-center gap-4">
      <span
        className={cn(
          "w-12 shrink-0 text-body-sm font-bold capitalize",
          closed ? "text-slate-mute" : "text-ink",
        )}
      >
        {dayName(day, "short")}
      </span>
      <div
        ref={track}
        role="group"
        aria-label={dayName(day, "long")}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={(event) =>
          event.target === track.current && hover !== null && add(hover)
        }
        className={cn(
          "relative h-9 flex-1 cursor-copy rounded-lg",
          closed ? "border border-dashed border-fog bg-white" : "bg-ice-blue",
        )}
      >
        {closed && hover === null ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption text-slate-mute">
            {t("hoverHint")}
          </span>
        ) : null}
        {ranges.map((range, index) => (
          <Slot
            key={range.start}
            day={day}
            index={index}
            ranges={ranges}
            source={source}
            pct={pct}
            minutesAt={minutesAt}
          />
        ))}
        {hover !== null ? (
          <>
            <span
              aria-hidden={true}
              className="pointer-events-none absolute inset-y-1 rounded-md border-2 border-dashed border-steel-blue bg-white"
              style={{
                left: `${pct(hover)}%`,
                width: `${pct(ghostEnd) - pct(hover)}%`,
              }}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                add(hover);
              }}
              className="absolute bottom-full z-10 mb-1.5 flex -translate-x-1/4 items-center gap-1.5 rounded-full bg-navy-deep px-2.5 py-1 text-caption font-bold whitespace-nowrap text-white shadow-md"
              style={{ left: `${pct(hover)}%` }}
            >
              <Plus aria-hidden={true} className="size-3" strokeWidth={3} />
              {t("addAt", { time: shortHour(clockOf(hover)) })}
            </button>
          </>
        ) : null}
      </div>
      <span
        className={cn(
          "w-40 shrink-0 truncate text-body-sm",
          closed ? "text-slate-mute" : "text-ink",
        )}
      >
        {closed ? t("closed") : shortRanges(ranges)}
      </span>
      <button
        type="button"
        disabled={free === null}
        onClick={() => free !== null && add(free)}
        aria-label={t("addSlotDay", { day: dayName(day, "long") })}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-steel-blue hover:bg-ice-blue disabled:opacity-30"
      >
        <Plus aria-hidden={true} className="size-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

type SlotProps = {
  day: number;
  index: number;
  ranges: DayRange[];
  source: HoursSource;
  pct: (minutes: number) => number;
  minutesAt: (clientX: number) => number;
};

/** One slot on the timeline: click for exact hours, drag an edge, × to remove. */
function Slot({
  day,
  index,
  ranges,
  source,
  pct,
  minutesAt,
}: SlotProps): ReactNode {
  const t = useTranslations("Consultation.admin.availability");
  const id = useId();
  const range = ranges[index]!;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [invalid, setInvalid] = useState(false);
  const label = shortRanges([range]);

  const drag =
    (edge: "start" | "end") => (event: ReactPointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      let current = ranges;
      const move = (e: PointerEvent) => {
        current = resizeSlot(current, index, edge, minutesAt(e.clientX));
        source.setRanges(day, current);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    };

  return (
    <div
      className="group absolute inset-y-1 rounded-md bg-steel-blue text-white hover:inset-y-0.5 hover:bg-navy-deep hover:shadow-md"
      style={{
        left: `${pct(minutesOf(range.start))}%`,
        width: `${pct(minutesOf(range.end)) - pct(minutesOf(range.start))}%`,
      }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setStart(range.start);
            setEnd(range.end);
            setInvalid(false);
          }
        }}
      >
        <PopoverTrigger
          aria-label={t("editSlot", { range: label })}
          className="absolute inset-0 flex items-center truncate rounded-md px-2.5 text-caption font-bold"
        >
          {label}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 gap-3 rounded-2xl bg-white p-3.5"
        >
          <div className="flex gap-2">
            {(["start", "end"] as const).map((edge) => (
              <label
                key={edge}
                className="flex flex-1 flex-col gap-1 text-caption text-slate"
              >
                {t(edge === "start" ? "from" : "to")}
                <select
                  value={edge === "start" ? start : end}
                  onChange={(e) =>
                    edge === "start"
                      ? setStart(e.target.value)
                      : setEnd(e.target.value)
                  }
                  aria-describedby={invalid ? `${id}-invalid` : undefined}
                  className="h-9 rounded-lg border border-fog bg-white px-2 text-body-sm font-semibold text-ink"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {invalid ? (
            <p
              id={`${id}-invalid`}
              role="alert"
              className="text-caption font-semibold text-rouge"
            >
              {t("overlap")}
            </p>
          ) : null}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                source.setRanges(
                  day,
                  ranges.filter((_, i) => i !== index),
                );
                setOpen(false);
              }}
              className="text-body-sm font-bold text-rouge"
            >
              {t("remove")}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = setSlot(ranges, index, start, end);
                if (!next) return setInvalid(true);
                source.setRanges(day, next);
                setOpen(false);
              }}
              className="rounded-full bg-navy-deep px-4 py-1.5 text-body-sm font-bold text-white"
            >
              {t("ok")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <span
        aria-hidden={true}
        onPointerDown={drag("start")}
        className="absolute inset-y-0 -left-1 w-3 cursor-ew-resize rounded-l-md group-hover:bg-white/30"
      />
      <span
        aria-hidden={true}
        onPointerDown={drag("end")}
        className="absolute inset-y-0 -right-1 w-3 cursor-ew-resize rounded-r-md group-hover:bg-white/30"
      />
      {/* Short slots keep their label: they are removed from their popover. */}
      {minutesOf(range.end) - minutesOf(range.start) >= 120 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            source.setRanges(
              day,
              ranges.filter((_, i) => i !== index),
            );
          }}
          aria-label={t("removeSlot", { range: label })}
          className="absolute top-1/2 right-2.5 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X aria-hidden={true} className="size-2.5" strokeWidth={3.5} />
        </button>
      ) : null}
    </div>
  );
}

/** Phones: one line per day, « 9h–13h · 18h–22h »; tapping opens its sheet. */
function DayList({ source }: { source: HoursSource }): ReactNode {
  const t = useTranslations("Consultation.admin.availability");
  const dayName = useDayName();
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div className="flex flex-col md:hidden">
      <ul className="flex flex-col divide-y divide-fog-light">
        {DAYS.map((day) => {
          const ranges = source.ranges(day);
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => setEditing(day)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span
                  className={cn(
                    "w-24 shrink-0 text-body font-bold capitalize",
                    ranges.length ? "text-ink" : "text-slate-mute",
                  )}
                >
                  {dayName(day, "long")}
                </span>
                <span
                  className={cn(
                    "flex-1 text-right text-body-sm",
                    ranges.length ? "text-ink" : "text-slate-mute",
                  )}
                >
                  {ranges.length ? shortRanges(ranges) : t("closed")}
                </span>
                <ChevronRight
                  aria-hidden={true}
                  className="size-4 shrink-0 text-slate-mute"
                  strokeWidth={2.4}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <Drawer
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        showSwipeHandle={true}
      >
        <DrawerContent className="max-h-dvh overflow-y-auto rounded-t-3xl bg-white px-5 pt-2 pb-7 md:hidden">
          {editing !== null ? (
            <DaySheet
              key={editing}
              day={editing}
              source={source}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

type Draft = { start: string; end: string };

/** The day's sheet: Disponible, its slots (De / À), « Ajouter une plage », « Copier vers », Enregistrer. */
function DaySheet({
  day,
  source,
  onDone,
}: {
  day: number;
  source: HoursSource;
  onDone: () => void;
}): ReactNode {
  const t = useTranslations("Consultation.admin.availability");
  const dayName = useDayName();
  const id = useId();
  const [slots, setSlots] = useState<Draft[]>(() =>
    source.ranges(day).map(({ start, end }) => ({ start, end })),
  );
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const open = slots.length > 0;
  const ordered = slots.toSorted((a, b) => a.start.localeCompare(b.start));
  const invalid = ordered.some(
    (s, i) =>
      minutesOf(s.start) >= minutesOf(s.end) ||
      (i > 0 && minutesOf(s.start) < minutesOf(ordered[i - 1]!.end)),
  );

  const addOne = () => {
    const asRanges = slots.map((s) => ({ day, ...s }));
    const start = firstFreeStart(asRanges);
    if (start === null) return;
    const added = addSlot(asRanges, day, start);
    setSlots(added.map(({ start: s, end: e }) => ({ start: s, end: e })));
  };
  const save = () => {
    const ranges = ordered.map((s) => ({ day, ...s }));
    const days: Record<number, DayRange[]> = { [day]: ranges };
    for (const other of copyTo)
      days[other] = ranges.map((r) => ({ ...r, day: other }));
    source.saveDays(days);
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pt-3">
        <DrawerTitle className="font-heading text-h4 font-extrabold text-navy-deep capitalize">
          {dayName(day, "long")}
        </DrawerTitle>
        <label className="flex items-center gap-2.5 text-body-sm text-slate">
          {t("available")}
          <input
            type="checkbox"
            role="switch"
            checked={open}
            onChange={(e) =>
              setSlots(
                e.target.checked ? [{ start: "09:00", end: "13:00" }] : [],
              )
            }
            className="peer sr-only"
          />
          <span
            aria-hidden={true}
            className={cn(
              "relative h-6.5 w-11 rounded-full transition-colors",
              open ? "bg-leaf" : "bg-fog",
            )}
          >
            <span
              className={cn(
                "absolute top-0.75 size-5 rounded-full bg-white transition-transform",
                open ? "translate-x-5.5" : "translate-x-0.75",
              )}
            />
          </span>
        </label>
      </div>

      {slots.map((slot, index) => (
        <div key={index} className="flex items-end gap-2.5">
          {(["start", "end"] as const).map((edge) => (
            <label
              key={edge}
              className="flex flex-1 flex-col gap-1 text-caption text-slate"
            >
              {index === 0 ? (
                t(edge === "start" ? "from" : "to")
              ) : (
                <span className="sr-only">
                  {t(edge === "start" ? "from" : "to")}
                </span>
              )}
              <select
                value={slot[edge]}
                onChange={(e) =>
                  setSlots((all) =>
                    all.map((s, i) =>
                      i === index ? { ...s, [edge]: e.target.value } : s,
                    ),
                  )
                }
                className="h-12 rounded-xl border border-fog bg-white px-3 text-body font-semibold text-ink"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setSlots((all) => all.filter((_, i) => i !== index))}
            aria-label={t("removeSlot", { range: shortRanges([slot]) })}
            className="flex size-12 items-center justify-center text-slate"
          >
            <X aria-hidden={true} className="size-4.5" strokeWidth={2.4} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOne}
        className="flex h-11 items-center gap-2.5 self-start text-body font-bold text-steel-blue"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-ice-blue">
          <Plus aria-hidden={true} className="size-3.5" strokeWidth={2.8} />
        </span>
        {t("addSlot")}
      </button>
      {invalid ? (
        <p
          id={`${id}-invalid`}
          role="alert"
          className="text-caption font-semibold text-rouge"
        >
          {t("overlap")}
        </p>
      ) : null}

      <fieldset className="flex items-center justify-between gap-3 border-t border-fog-light pt-3">
        <legend className="sr-only">{t("copyTo")}</legend>
        <span aria-hidden={true} className="text-body-sm text-ink">
          {t("copyTo")}
        </span>
        <span className="flex gap-1.5">
          {DAYS.filter((d) => d !== day).map((other) => {
            const on = copyTo.includes(other);
            return (
              <label
                key={other}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-full font-label text-label font-bold capitalize",
                  on
                    ? "bg-navy-deep text-white"
                    : "border border-fog text-slate",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  aria-label={dayName(other, "long")}
                  onChange={() =>
                    setCopyTo((all) =>
                      on ? all.filter((d) => d !== other) : [...all, other],
                    )
                  }
                />
                {dayName(other, "short").slice(0, 2)}
              </label>
            );
          })}
        </span>
      </fieldset>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onDone}
          className={cn(
            "h-13 flex-1 rounded-full border border-fog font-heading text-body font-bold text-ink",
            PRESS,
          )}
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={invalid}
          onClick={save}
          className={cn(
            "h-13 flex-1 rounded-full bg-leaf font-heading text-body font-bold text-white disabled:opacity-50",
            PRESS,
          )}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
