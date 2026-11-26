'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { PRESS } from '@/features/consultation/lib/styles';
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

const row = 'flex items-center justify-between gap-4 border-t border-fog-light py-3 text-body-sm leading-5';
const number = 'h-10 w-24 rounded-lg border border-fog bg-white px-3 text-right font-semibold text-ink outline-none focus:border-2 focus:border-navy-deep';

/**
 * Disponibilités (`Tableau de bord · Consultations`, right column; the mobile
 * sheet « Mes disponibilités »): each day's ranges in Douala time, the
 * Consultation's length, the pause between two, how early and how far ahead
 * one can book, until when the Client can move it, the price, and blocked
 * dates. « Enregistrer » saves it all; the public page follows.
 */
export function AvailabilityForm({ settings, onSaved }: { settings: Settings; onSaved?: () => void }): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
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
  const [blocking, setBlocking] = useState(false);
  const [newBlocked, setNewBlocked] = useState('');
  const [badDays, setBadDays] = useState<number[]>([]);

  const save = useMutation(
    trpc.consultationAdmin.saveSettings.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationAdmin.settings.queryKey() });
        toast.add({ title: t('saved'), type: 'success' });
        onSaved?.();
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weeklyHours: Range[] = [];
    const bad: number[] = [];
    for (const day of DAYS) {
      const ranges = parseRanges(day, days[day] ?? '');
      if (ranges === null) bad.push(day);
      else weeklyHours.push(...ranges);
    }
    setBadDays(bad);
    if (bad.length) return;
    const int = (value: string, fallback: number) => (Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback);
    save.mutate({
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

  const dayName = (day: number) => format.dateTime(new Date(Date.UTC(2026, 10, 22 + day)), { weekday: 'short', timeZone: 'UTC' });
  const numberRow = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className={row}>
      <span className="text-slate">{label}</span>
      <span className="flex items-center gap-2">
        <input inputMode="numeric" value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} className={number} />
        <span className="w-12 text-caption text-slate">{unit}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col">
      <fieldset className="flex flex-col gap-2 pb-4">
        <legend className="sr-only">{t('hours')}</legend>
        {DAYS.map((day) => {
          const off = !(days[day] ?? '').trim();
          return (
            <label key={day} className="flex items-center gap-3">
              <span className={cn('w-10 text-body-sm font-bold capitalize', off ? 'text-slate-mute' : 'text-ink')}>{dayName(day)}</span>
              <input
                value={days[day] ?? ''}
                onChange={(e) => setDays((all) => ({ ...all, [day]: e.target.value }))}
                placeholder={t('off')}
                aria-invalid={badDays.includes(day)}
                aria-describedby={badDays.includes(day) ? `${id}-hours-error` : undefined}
                className={cn(
                  'h-10 min-w-0 flex-1 rounded-lg px-3 text-body-sm text-ink outline-none placeholder:text-slate-mute focus:border-2 focus:border-navy-deep',
                  off ? 'border border-dashed border-fog bg-white' : 'bg-ice-blue',
                  badDays.includes(day) && 'border-2 border-rouge',
                )}
              />
            </label>
          );
        })}
        {badDays.length ? (
          <p id={`${id}-hours-error`} role="alert" className="text-caption leading-4 font-semibold text-rouge">
            {t('hoursError')}
          </p>
        ) : (
          <p className="text-caption leading-4 text-slate">{t('hoursHint')}</p>
        )}
      </fieldset>

      {numberRow(t('duration'), duration, setDuration, 'min')}
      {numberRow(t('buffer'), buffer, setBuffer, 'min')}
      {numberRow(t('notice'), notice, setNotice, t('hoursUnit'))}
      {numberRow(t('horizon'), weeks, setWeeks, t('weeksUnit'))}
      {numberRow(t('cutoff'), cutoff, setCutoff, t('hoursUnit'))}
      <label className={row}>
        <span className="flex flex-col">
          <span className="text-slate">{t('price')}</span>
          {price ? null : <span className="text-caption leading-4 text-honey">{t('noPrice')}</span>}
        </span>
        <span className="flex items-center gap-2">
          <input inputMode="numeric" value={price} placeholder="—" onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} className={cn(number, 'w-28')} />
          <span className="w-12 text-caption text-slate">FCFA</span>
        </span>
      </label>

      {blocked.length || blocking ? (
        <div className="flex flex-col gap-2 border-t border-fog-light py-3">
          <p className="text-body-sm text-slate">{t('blocked')}</p>
          <ul className="flex flex-wrap gap-2">
            {blocked.map((day) => (
              <li key={day} className="flex items-center gap-1.5 rounded-full bg-blush py-1 pr-1.5 pl-3 text-caption font-semibold text-rouge">
                {format.dateTime(new Date(`${day}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                <button type="button" onClick={() => setBlocked((all) => all.filter((d) => d !== day))} aria-label={t('unblock', { day })} className="rounded-full p-0.5 hover:bg-rouge/10">
                  <X aria-hidden={true} className="size-3" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
          {blocking ? (
            <div className="flex gap-2">
              <label htmlFor={`${id}-block`} className="sr-only">
                {t('blockDate')}
              </label>
              <input id={`${id}-block`} type="date" value={newBlocked} onChange={(e) => setNewBlocked(e.target.value)} className="h-10 flex-1 rounded-lg border border-fog px-3 text-body-sm" />
              <button
                type="button"
                disabled={!newBlocked}
                onClick={() => {
                  setBlocked((all) => [...new Set([...all, newBlocked])].toSorted());
                  setNewBlocked('');
                  setBlocking(false);
                }}
                className="h-10 rounded-lg bg-navy-deep px-4 text-body-sm font-semibold text-white disabled:opacity-50"
              >
                {t('add')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={() => setBlocking(true)} className={cn('h-12 flex-1 rounded-full border border-fog font-heading text-body-sm font-bold text-ink', PRESS)}>
          {t('blockDate')}
        </button>
        <button type="submit" disabled={save.isPending} className={cn('h-12 flex-1 rounded-full bg-leaf font-heading text-body-sm font-bold text-white disabled:opacity-60', PRESS)}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
