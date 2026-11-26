'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { AvailabilityForm } from '@/features/consultation/components/availability-form';
import { fcfa } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

type Window = { day: number; start: string; end: string };

/** « 09:00 » → « 09 », « 09:30 » stays. */
const short = (time: string) => (time.endsWith(':00') ? time.slice(0, 2) : time);

/** Days with the same hours together: [« 1,2 », « 09–12 · 14–16 »], Monday first. */
export function groupHours(weeklyHours: Window[]): { days: number[]; hours: string }[] {
  const byDay = new Map<number, string>();
  for (const day of [1, 2, 3, 4, 5, 6, 7]) {
    const hours = weeklyHours
      .filter((w) => w.day === day)
      .toSorted((a, b) => a.start.localeCompare(b.start))
      .map((w) => `${short(w.start)}–${short(w.end)}`)
      .join(' · ');
    if (hours) byDay.set(day, hours);
  }
  const groups: { days: number[]; hours: string }[] = [];
  for (const [day, hours] of byDay) {
    const same = groups.find((g) => g.hours === hours);
    if (same) same.days.push(day);
    else groups.push({ days: [day], hours });
  }
  return groups;
}

/** « lun – ven » for three days or more in a row, else « lun, mer ». */
export function dayList(days: number[], name: (day: number) => string): string {
  const runs: number[][] = [];
  for (const day of days) {
    const last = runs.at(-1);
    if (last && last.at(-1) === day - 1) last.push(day);
    else runs.push([day]);
  }
  return runs.map((run) => (run.length >= 3 ? `${name(run[0]!)} – ${name(run.at(-1)!)}` : run.map(name).join(', '))).join(', ');
}

/**
 * The Calendrier's Disponibilités in one line (`Consultations · C · Barre`):
 * the open hours, the rules, the price, and « Modifier », which opens the
 * side panel to change something on the go.
 */
export function AvailabilityBar(): ReactNode {
  const t = useTranslations('Consultation.admin.availability');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  const { data: settings } = useSuspenseQuery(trpc.consultationAdmin.settings.queryOptions());
  const [open, setOpen] = useState(false);
  const dayName = (day: number) => format.dateTime(new Date(Date.UTC(2026, 10, 22 + day)), { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  const groups = groupHours(settings.weeklyHours);

  return (
    <section aria-label={t('title')} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-fog-light bg-white py-3.5 pr-4 pl-5">
      <h2 className="font-heading text-body font-bold whitespace-nowrap text-navy-deep">{t('title')}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {groups.length ? (
          groups.map((g) => (
            <li key={g.hours} className="rounded-full bg-ice-blue px-2.5 py-1 text-caption font-semibold whitespace-nowrap text-ink capitalize">
              {dayList(g.days, dayName)} {g.hours}
            </li>
          ))
        ) : (
          <li className="text-caption text-honey">{t('noHours')}</li>
        )}
      </ul>
      <span className="hidden h-6 w-px bg-fog-light xl:block" />
      <span className="text-caption whitespace-nowrap text-slate">
        {t('rulesSummary', {
          duration: settings.durationMinutes,
          buffer: settings.bufferMinutes,
          notice: settings.minNoticeHours,
          weeks: Math.max(1, Math.round(settings.horizonDays / 7)),
        })}
      </span>
      <span className="hidden h-6 w-px bg-fog-light xl:block" />
      <span className={cn('text-body-sm font-bold whitespace-nowrap', settings.price === null ? 'text-honey' : 'text-ink')}>
        {settings.price === null ? t('noPriceShort') : fcfa(settings.price, locale === 'en' ? 'en-US' : 'fr-FR')}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('ml-auto flex h-9 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-caption font-bold text-white', PRESS)}
      >
        <Pencil aria-hidden={true} className="size-3.5" strokeWidth={2.4} />
        {t('edit')}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="gap-0 bg-white p-0">
          <div className="flex flex-col gap-1 border-b border-fog-light px-6 pt-6 pb-4 pr-14">
            <SheetTitle className="font-heading text-h4 font-extrabold text-navy-deep">{t('title')}</SheetTitle>
            <SheetDescription className="text-caption leading-4 text-slate">{t('panelLead')}</SheetDescription>
          </div>
          {/* A new draft each time it opens. */}
          {open ? <AvailabilityForm settings={settings} layout="panel" onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
