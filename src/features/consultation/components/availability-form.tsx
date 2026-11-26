'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { WeekHours } from '@/features/consultation/components/week-hours';
import { mergeTouching } from '@/features/consultation/lib/day-ranges';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Settings = RouterOutputs['consultationAdmin']['settings'];
type Range = { day: number; start: string; end: string };

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** « 09:00 – 12:00 · 14:00 – 16:00 » for a day's ranges; empty when the day is off. */
export const rangesText = (ranges: Range[]): string => ranges.map((r) => `${r.start} – ${r.end}`).join(' · ');

/** The other way: null when it can't be read. Empty text means the day is off. */
export function parseRanges(day: number, text: string): Range[] | null {
  const parts = text.split(/[·,;]/).map((part) => part.trim()).filter(Boolean);
  const ranges: Range[] = [];
  for (const part of parts) {
    const match = /^(\d{1,2})[:h.](\d{2})\s*[–—-]\s*(\d{1,2})[:h.](\d{2})$/.exec(part);
    if (!match) return null;
    const [, h1, m1, h2, m2] = match;
    const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;
    const start = pad(h1!, m1!);
    const end = pad(h2!, m2!);
    if (Number(h1) > 23 || Number(h2) > 23 || start >= end) return null;
    ranges.push({ day, start, end });
  }
  return ranges;
}

/**
 * The Disponibilités being edited: each day's ranges as typed, the numbers,
 * the price and the blocked dates; `submit` checks the hours and saves.
 */
function useAvailabilityDraft(settings: Settings, onSaved?: () => void) {
  const t = useTranslations('Consultation.admin.availability');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<Record<number, string>>(() =>
    Object.fromEntries(DAYS.map((day) => [day, rangesText(settings.weeklyHours.filter((r) => r.day === day))])),
  );
  const [duration, setDuration] = useState(String(settings.durationMinutes));
  const [buffer, setBuffer] = useState(String(settings.bufferMinutes));
  const [notice, setNotice] = useState(String(settings.minNoticeHours));
  const [weeks, setWeeks] = useState(String(Math.max(1, Math.round(settings.horizonDays / 7))));
  const [cutoff, setCutoff] = useState(String(settings.moveCutoffHours));
  const [price, setPrice] = useState(settings.price === null ? '' : String(settings.price));
  const [blocked, setBlocked] = useState<string[]>(settings.blockedDates);
  const [badDays, setBadDays] = useState<number[]>([]);

  const save_ = useMutation(
    trpc.consultationAdmin.saveSettings.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationAdmin.settings.queryKey() });
        toast.add({ title: t('saved'), type: 'success' });
        onSaved?.();
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );

  /** Checks every day's hours and saves it all; `current` when the days were just changed. */
  function save(current: Record<number, string> = days) {
    const weeklyHours: Range[] = [];
    const bad: number[] = [];
    for (const day of DAYS) {
      const ranges = parseRanges(day, current[day] ?? '');
      if (ranges === null) bad.push(day);
      else weeklyHours.push(...ranges);
    }
    setBadDays(bad);
    if (bad.length) return;
    const int = (value: string, fallback: number) => (Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback);
    save_.mutate({
      weeklyHours,
      durationMinutes: int(duration, 45),
      bufferMinutes: int(buffer, 0),
      minNoticeHours: int(notice, 24),
      horizonDays: int(weeks, 4) * 7,
      moveCutoffHours: int(cutoff, 24),
      price: price.trim() ? int(price.replace(/\D/g, ''), 0) || null : null,
      blockedDates: blocked,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  const digits = (set: (v: string) => void) => (value: string) => set(value.replace(/\D/g, ''));
  return {
    days,
    setDay: (day: number, text: string) => setDays((all) => ({ ...all, [day]: text })),
    badDays,
    numbers: [
      { key: 'duration', value: duration, set: digits(setDuration), unit: 'min' },
      { key: 'buffer', value: buffer, set: digits(setBuffer), unit: 'min' },
      { key: 'notice', value: notice, set: digits(setNotice), unit: t('hoursUnit') },
      { key: 'horizon', value: weeks, set: digits(setWeeks), unit: t('weeksUnit') },
      { key: 'cutoff', value: cutoff, set: digits(setCutoff), unit: t('hoursUnit') },
    ] as const,
    price,
    setPrice: digits(setPrice),
    blocked,
    block: (day: string) => setBlocked((all) => [...new Set([...all, day])].toSorted()),
    unblock: (day: string) => setBlocked((all) => all.filter((d) => d !== day)),
    submit,
    saving: save_.isPending,
    ranges: (day: number) => parseRanges(day, days[day] ?? '') ?? [],
    setRanges: (day: number, ranges: Range[]) => setDays((all) => ({ ...all, [day]: rangesText(mergeTouching(ranges)) })),
    saveDays: (changes: Record<number, Range[]>) => {
      const next = { ...days, ...Object.fromEntries(Object.entries(changes).map(([day, ranges]) => [day, rangesText(mergeTouching(ranges))])) };
      setDays(next);
      save(next);
    },
  };
}

type Draft = ReturnType<typeof useAvailabilityDraft>;

/**
 * Disponibilités, two ways (`Tableau de bord · Consultations · C`): `panel`,
 * the side panel « Modifier » opens over the calendar, to change something on
 * the go; `page`, the « Disponibilités » view, with each day's hours drawn on
 * a timeline. Both save everything at once; the public page follows.
 */
export function AvailabilityForm({
  settings,
  layout = 'panel',
  onSaved,
  onCancel,
}: {
  settings: Settings;
  layout?: 'panel' | 'page';
  onSaved?: () => void;
  onCancel?: () => void;
}): ReactNode {
  const draft = useAvailabilityDraft(settings, onSaved);
  return layout === 'page' ? <PageLayout draft={draft} /> : <PanelLayout draft={draft} onCancel={onCancel} />;
}

function PanelLayout({ draft, onCancel }: { draft: Draft; onCancel?: () => void }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  return (
    <form onSubmit={draft.submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-2.5">
          <p className={cn(LABEL_CLASS, 'text-slate')}>{t('hoursShort')}</p>
          <DayFields draft={draft} />
        </section>
        <section className="flex flex-col gap-2.5">
          <p className={cn(LABEL_CLASS, 'text-slate')}>{t('rules')}</p>
          <div className="flex flex-col">
            {draft.numbers.map((n) => (
              <label key={n.key} className="flex items-center justify-between gap-3 border-b border-fog-light py-2 text-body-sm">
                <span className="text-slate">{t(n.key)}</span>
                <NumberInput value={n.value} onChange={n.set} unit={n.unit} />
              </label>
            ))}
          </div>
          <PriceField draft={draft} compact />
        </section>
        <section className="flex flex-col gap-2.5">
          <p className={cn(LABEL_CLASS, 'text-slate')}>{t('blocked')}</p>
          <BlockedDates draft={draft} />
        </section>
      </div>
      <div className="flex gap-3 border-t border-fog-light px-6 pt-4 pb-6">
        <button type="button" onClick={onCancel} className={cn('h-12 flex-1 rounded-full border border-fog font-heading text-body-sm font-bold text-ink', PRESS)}>
          {t('cancel')}
        </button>
        <SaveButton draft={draft} className="flex-1" />
      </div>
    </form>
  );
}

function PageLayout({ draft }: { draft: Draft }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  return (
    <form onSubmit={draft.submit} className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section aria-labelledby="week-hours" className="flex min-w-0 flex-1 flex-col gap-4 rounded-3xl border border-fog-light bg-white p-5 lg:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="week-hours" className="font-heading text-h4 font-bold text-navy-deep">
            {t('weekHours')}
          </h2>
          <span className="hidden text-caption whitespace-nowrap text-slate sm:inline">{t('douala')}</span>
        </div>
        <WeekHours source={draft} />
      </section>

      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-90">
        <section aria-label={t('rules')} className="flex flex-col rounded-3xl border border-fog-light bg-white px-5 py-2 lg:px-6">
          {draft.numbers.map((n) => (
            <label key={n.key} className="flex items-center justify-between gap-4 border-b border-fog-light py-3 text-body-sm last:border-b-0">
              <span className="text-slate">{t(n.key)}</span>
              <NumberInput value={n.value} onChange={n.set} unit={n.unit} />
            </label>
          ))}
        </section>
        <section aria-label={t('price')} className="flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-5 lg:p-6">
          <PriceField draft={draft} />
          <div className="flex flex-col gap-2 border-t border-fog-light pt-4">
            <p className="text-body-sm font-bold text-ink">{t('blocked')}</p>
            <BlockedDates draft={draft} />
          </div>
        </section>
        <SaveButton draft={draft} />
      </div>
    </form>
  );
}

/** Each day's ranges, as text (the side panel). */
function DayFields({ draft }: { draft: Draft }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  const format = useFormatter();
  const id = useId();
  const dayName = (day: number) => format.dateTime(new Date(Date.UTC(2026, 10, 22 + day)), { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t('hours')}</legend>
      {DAYS.map((day) => {
        const text = draft.days[day] ?? '';
        const off = !text.trim();
        const bad = draft.badDays.includes(day);
        return (
          <label key={day} className="flex items-center gap-3">
            <span className={cn('w-10 shrink-0 text-body-sm font-bold capitalize', off ? 'text-slate-mute' : 'text-ink')}>{dayName(day)}</span>
            <input
              value={text}
              onChange={(e) => draft.setDay(day, e.target.value)}
              placeholder={t('off')}
              aria-invalid={bad}
              aria-describedby={bad ? `${id}-hours-error` : undefined}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-lg px-3 text-body-sm text-ink outline-none placeholder:text-slate-mute focus:border-2 focus:border-navy-deep',
                off ? 'border border-dashed border-fog bg-white' : 'bg-ice-blue',
                bad && 'border-2 border-rouge',
              )}
            />
          </label>
        );
      })}
      {draft.badDays.length ? (
        <p id={`${id}-hours-error`} role="alert" className="text-caption leading-4 font-semibold text-rouge">
          {t('hoursError')}
        </p>
      ) : (
        <p className="pt-1 text-caption leading-4 text-slate">{t('hoursHint')}</p>
      )}
    </fieldset>
  );
}

function NumberInput({ value, onChange, unit }: { value: string; onChange: (value: string) => void; unit: string }): ReactNode {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-fog bg-white px-2.5 focus-within:border-navy-deep">
      <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 bg-transparent text-right text-body-sm font-bold text-ink outline-none" />
      <span className="text-caption whitespace-nowrap text-slate">{unit}</span>
    </span>
  );
}

function PriceField({ draft, compact = false }: { draft: Draft; compact?: boolean }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  const missing = !draft.price;
  return (
    <label className={cn('flex items-center justify-between gap-3', compact && cn('rounded-xl border py-2 pr-2 pl-3', missing ? 'border-honey bg-honey-tint' : 'border-leaf bg-leaf-tint'))}>
      <span className="flex flex-col">
        <span className={cn('font-bold', compact ? cn('text-caption leading-4', missing ? 'text-honey' : 'text-leaf') : 'text-body-sm text-ink')}>{t('price')}</span>
        {missing && !compact ? <span className="text-caption leading-4 text-honey">{t('noPrice')}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-fog bg-white px-2.5 focus-within:border-navy-deep">
        <input
          inputMode="numeric"
          value={draft.price}
          placeholder="—"
          onChange={(e) => draft.setPrice(e.target.value)}
          className={cn('h-8 bg-transparent text-right font-bold text-ink outline-none', compact ? 'w-14 text-body-sm' : 'w-20 text-body')}
        />
        <span className="text-caption text-slate">FCFA</span>
      </span>
    </label>
  );
}

function BlockedDates({ draft }: { draft: Draft }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  const format = useFormatter();
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {draft.blocked.map((d) => (
          <li key={d} className="flex items-center gap-1.5 rounded-full bg-blush py-1 pr-1.5 pl-3 text-caption font-semibold text-rouge">
            {format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
            <button type="button" onClick={() => draft.unblock(d)} aria-label={t('unblock', { day: d })} className="rounded-full p-0.5 hover:bg-rouge/10">
              <X aria-hidden={true} className="size-3" strokeWidth={2.5} />
            </button>
          </li>
        ))}
        {adding ? null : (
          <li>
            <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-fog px-3 py-1 text-caption font-bold text-ink hover:bg-off-white">
              + {t('blockDate')}
            </button>
          </li>
        )}
      </ul>
      {adding ? (
        <div className="flex gap-2">
          <label htmlFor={`${id}-block`} className="sr-only">
            {t('blockDate')}
          </label>
          <input id={`${id}-block`} type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-10 flex-1 rounded-lg border border-fog px-3 text-body-sm" />
          <button
            type="button"
            disabled={!day}
            onClick={() => {
              draft.block(day);
              setDay('');
              setAdding(false);
            }}
            className="h-10 rounded-lg bg-navy-deep px-4 text-body-sm font-semibold text-white disabled:opacity-50"
          >
            {t('add')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SaveButton({ draft, className }: { draft: Draft; className?: string }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  return (
    <button type="submit" disabled={draft.saving} className={cn('h-12 shrink-0 rounded-full bg-leaf px-8 font-heading text-body-sm font-bold text-white disabled:opacity-60', PRESS, className)}>
      {t('save')}
    </button>
  );
}
