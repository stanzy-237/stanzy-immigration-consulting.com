'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, type CSSProperties, type ReactNode } from 'react';

import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { doualaClock, hourRange, mondayOf, openSpans, placeOnGrid, startOfDay, weekDays, type HourRange } from '@/features/consultation/lib/week-calendar';
import { addDays, doualaDay } from '@/features/notifications/lib/douala-days';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Week = RouterOutputs['consultationAdmin']['calendar'];
type Settings = RouterOutputs['consultationAdmin']['settings'];

/** Pixels per hour: the week grid (desktop) and the day (mobile). */
const WEEK_HOUR = 56;
const DAY_HOUR = 64;

/** Something drawn on the calendar. */
type Block = {
  key: string;
  kind: 'paid' | 'held' | 'meeting';
  href: string;
  /** The Client's name, or the Réunion's subject. */
  title: string;
  day: string;
  start: number;
  end: number;
  past: boolean;
  heldMinutes: number;
};

/** « Grace Nkeng » → « Grace N. », for the week's narrow columns. */
export const shortName = (name: string): string => {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? `${words[0]} ${words.at(-1)!.charAt(0)}.` : name;
};

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function blocksOf(week: Week, now: Date): Block[] {
  const toBlock = (key: string, kind: Block['kind'], href: string, title: string, startsAt: Date | string, durationMinutes: number, heldUntil: Date | string | null = null): Block => {
    const starts = new Date(startsAt);
    const { day, minutes } = doualaClock(starts);
    return {
      key,
      kind,
      href,
      title,
      day,
      start: minutes,
      end: minutes + durationMinutes,
      past: starts.getTime() + durationMinutes * 60_000 <= now.getTime(),
      heldMinutes: heldUntil ? Math.max(0, Math.ceil((new Date(heldUntil).getTime() - now.getTime()) / 60_000)) : 0,
    };
  };
  return [
    ...week.consultations.map((c) =>
      toBlock(c.id, c.status === 'PAID' ? 'paid' : 'held', `/consultations/${c.id}`, c.name, c.startsAt, c.durationMinutes, c.status === 'HELD' ? c.heldUntil : null),
    ),
    ...week.meetings.map((m) => toBlock(m.id, 'meeting', `/reunions/${m.id}`, m.subject, m.startsAt, m.durationMinutes)),
  ];
}

const KIND_CLASS: Record<Block['kind'], string> = {
  paid: 'border-l-3 border-leaf bg-leaf-tint',
  held: 'border border-dashed border-honey bg-honey-tint',
  meeting: 'border border-fog bg-white',
};
const KIND_TEXT: Record<Block['kind'], string> = { paid: 'text-leaf', held: 'text-honey', meeting: 'text-slate' };

/**
 * Tableau de bord → Consultations → « Calendrier » (#15, `Tableau de bord ·
 * Consultations · Calendrier`): one week on desktop, one day on mobile, with
 * the paid and held Consultations, the other Réunions, the open hours and the
 * blocked dates. Read-only: a block opens its Consultation or Réunion.
 */
export function ConsultationsCalendar({ week, onWeek }: { week: string; onWeek: (monday: string) => void }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationAdmin.calendar.queryOptions({ week }));
  const { data: settings } = useSuspenseQuery(trpc.consultationAdmin.settings.queryOptions());
  const now = useNow({ updateInterval: 60_000 });
  const today = doualaDay(now);
  const days = weekDays(data.week);
  const blocks = blocksOf(data, now);
  const thisWeek = days.includes(today) ? today : days[0]!;

  return (
    <>
      <WeekView days={days} blocks={blocks} settings={settings} today={today} now={now} onWeek={onWeek} />
      {/* The day picked resets with the week. */}
      <DayView key={data.week} days={days} initial={thisWeek} blocks={blocks} settings={settings} today={today} now={now} onWeek={onWeek} />
    </>
  );
}

type ViewProps = { days: string[]; blocks: Block[]; settings: Settings; today: string; now: Date; onWeek: (monday: string) => void };

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);

function WeekView({ days, blocks, settings, today, now, onWeek }: ViewProps): ReactNode {
  const t = useTranslations('Consultation.admin.calendar');
  const format = useFormatter();
  const range = hourRange(days, settings.weeklyHours, blocks.map((b) => ({ startsAt: atMinutes(b.day, b.start), durationMinutes: b.end - b.start })));
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i);
  const label = format.dateTimeRange(dayDate(days[0]!), dayDate(days[6]!), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <section aria-label={t('weekLabel', { week: label })} className="hidden flex-col overflow-hidden rounded-3xl border border-fog-light bg-white lg:flex">
      <div className="flex items-center justify-between border-b border-fog-light px-5 py-4">
        <div className="flex items-center gap-3">
          <WeekNav days={days} today={today} onWeek={onWeek} />
          <h2 className="font-heading text-body-lg font-extrabold text-navy-deep">{label}</h2>
        </div>
        <span className="text-caption text-slate">{t('douala')}</span>
      </div>

      <div className="flex border-b border-fog-light pr-3">
        <span className="w-12 shrink-0" />
        {days.map((day) => {
          const isToday = day === today;
          const past = day < today;
          return (
            <div key={day} className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
              <span className={cn(LABEL_CLASS, 'tracking-wide', isToday ? 'text-rouge' : past ? 'text-slate-mute' : 'text-slate')}>
                {format.dateTime(dayDate(day), { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}
              </span>
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full font-heading text-body font-extrabold',
                  isToday ? 'bg-rouge text-white' : past ? 'text-slate-mute' : 'text-ink',
                )}
              >
                {Number(day.slice(8))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex py-3 pr-3">
        <Hours hours={hours} perHour={WEEK_HOUR} />
        <div className="relative flex flex-1 border-y border-fog-light" style={{ height: hours.length * WEEK_HOUR }}>
          <HourLines count={hours.length} perHour={WEEK_HOUR} />
          {days.map((day) => (
            <DayColumn key={day} day={day} blocks={blocks} settings={settings} range={range} perHour={WEEK_HOUR} today={today} now={now} compact />
          ))}
        </div>
      </div>

      <Legend className="border-t border-fog-light bg-off-white px-5 py-3.5" />
    </section>
  );
}

function DayView({ days, initial, blocks, settings, today, now, onWeek }: ViewProps & { initial: string }): ReactNode {
  const t = useTranslations('Consultation.admin.calendar');
  const format = useFormatter();
  const [selected, setSelected] = useState(initial);
  const dayBlocks = blocks.filter((b) => b.day === selected);
  const blocked = settings.blockedDates.includes(selected);
  const open = openSpans(selected, settings.weeklyHours);
  const range = hourRange([selected], settings.weeklyHours, dayBlocks.map((b) => ({ startsAt: atMinutes(b.day, b.start), durationMinutes: b.end - b.start })));
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i);
  const empty = dayBlocks.length === 0 && (blocked || open.length === 0);

  return (
    <section aria-label={format.dateTime(dayDate(selected), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} className="flex flex-col gap-4 lg:hidden">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-body-lg font-extrabold text-navy-deep first-letter:uppercase">
            {format.dateTime(dayDate(selected), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </h2>
          <WeekNav days={days} today={today} onWeek={onWeek} />
        </div>
        <div role="tablist" aria-label={t('days')} className="flex gap-1">
          {days.map((day) => {
            const isSelected = day === selected;
            const isToday = day === today;
            const past = day < today;
            const busy = blocks.some((b) => b.day === day);
            const dayBlocked = settings.blockedDates.includes(day);
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={format.dateTime(dayDate(day), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                onClick={() => setSelected(day)}
                className={cn('flex flex-1 flex-col items-center gap-1 rounded-2xl py-2', isSelected && 'bg-navy-deep', PRESS)}
              >
                <span className={cn('font-label text-label font-bold uppercase', isSelected ? 'text-white' : isToday ? 'text-rouge' : past ? 'text-slate-mute' : 'text-slate')}>
                  {format.dateTime(dayDate(day), { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}
                </span>
                <span
                  className={cn(
                    'text-body font-bold',
                    isSelected ? 'text-white' : isToday ? 'text-rouge' : past ? 'text-slate-mute' : 'text-ink',
                    dayBlocked && 'line-through',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                <span aria-hidden={true} className={cn('size-1.5 rounded-full', busy ? (isSelected ? 'bg-leaf-tint' : 'bg-fog') : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
      </div>

      {empty ? (
        <p className="rounded-3xl border border-fog-light bg-white p-8 text-center text-body-sm leading-5 text-slate">{blocked ? t('blockedDay') : t('closedDay')}</p>
      ) : (
        <div className="flex rounded-3xl border border-fog-light bg-white py-3.5 pr-3">
          <Hours hours={hours} perHour={DAY_HOUR} />
          <div className="relative flex flex-1 border-t border-fog-light" style={{ height: hours.length * DAY_HOUR }}>
            <HourLines count={hours.length} perHour={DAY_HOUR} />
            <DayColumn day={selected} blocks={blocks} settings={settings} range={range} perHour={DAY_HOUR} today={today} now={now} />
          </div>
        </div>
      )}
      <Legend className="px-1" />
    </section>
  );
}

/** « ‹ Aujourd'hui › »: the week before, this week, the week after. */
function WeekNav({ days, today, onWeek }: { days: string[]; today: string; onWeek: (monday: string) => void }): ReactNode {
  const t = useTranslations('Consultation.admin.calendar');
  const round = 'flex size-8 items-center justify-center rounded-full border border-fog-light text-ink hover:bg-off-white';
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={t('previous')} onClick={() => onWeek(addDays(days[0]!, -7))} className={cn(round, PRESS)}>
        <ChevronLeft aria-hidden={true} className="size-4" strokeWidth={2.4} />
      </button>
      <button
        type="button"
        onClick={() => onWeek(mondayOf(today))}
        className={cn('h-8 rounded-full border border-fog-light px-3 text-caption font-semibold text-ink hover:bg-off-white', PRESS)}
      >
        {t('today')}
      </button>
      <button type="button" aria-label={t('next')} onClick={() => onWeek(addDays(days[0]!, 7))} className={cn(round, PRESS)}>
        <ChevronRight aria-hidden={true} className="size-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}

function Hours({ hours, perHour }: { hours: number[]; perHour: number }): ReactNode {
  return (
    <div aria-hidden={true} className="flex w-12 shrink-0 flex-col items-end pr-2">
      {hours.map((hour) => (
        <span key={hour} className="-translate-y-1.5 text-label leading-3.5 text-slate-mute" style={{ height: perHour }}>
          {clock(hour * 60)}
        </span>
      ))}
    </div>
  );
}

function HourLines({ count, perHour }: { count: number; perHour: number }): ReactNode {
  return (
    <div aria-hidden={true} className="pointer-events-none absolute inset-0">
      {Array.from({ length: count - 1 }, (_, i) => (
        <span key={i} className="absolute inset-x-0 h-px bg-fog-light" style={{ top: (i + 1) * perHour }} />
      ))}
    </div>
  );
}

type ColumnProps = { day: string; blocks: Block[]; settings: Settings; range: HourRange; perHour: number; today: string; now: Date; compact?: boolean };

/** One day: its open hours behind, its blocks on top, the hatching when it is blocked, the « now » line today. */
function DayColumn({ day, blocks, settings, range, perHour, today, now, compact = false }: ColumnProps): ReactNode {
  const t = useTranslations('Consultation.admin.calendar');
  const format = useFormatter();
  const px = (minutes: number) => (minutes / 60) * perHour;
  const blocked = settings.blockedDates.includes(day);
  const nowLine = day === today ? placeOnGrid(doualaClock(now).minutes, doualaClock(now).minutes + 1, range) : null;
  const dayBlocks = blocks.filter((b) => b.day === day);

  return (
    <div
      className={cn('relative flex-1', compact && 'border-l border-fog-light', blocked && 'bg-hatch-blush')}
      aria-label={compact ? format.dateTime(dayDate(day), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : undefined}
      role={compact ? 'group' : undefined}
    >
      {blocked ? (
        <span className="absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full border border-rose bg-white px-2 py-0.5 font-label text-label font-bold text-rouge">{t('blocked')}</span>
        </span>
      ) : (
        openSpans(day, settings.weeklyHours).map(([start, end]) => {
          const place = placeOnGrid(start, end, range);
          return place ? <span key={start} aria-hidden={true} className="absolute inset-x-0 bg-ice-blue/70" style={{ top: px(place.top), height: px(place.height) }} /> : null;
        })
      )}

      <ul>
        {dayBlocks.map((block) => {
          const place = placeOnGrid(block.start, block.end, range);
          if (!place) return null;
          const time = `${clock(block.start)} – ${clock(block.end)}`;
          const status = block.kind === 'paid' ? t('paid') : block.kind === 'held' ? t('held', { minutes: block.heldMinutes }) : t('meeting');
          const style: CSSProperties = { top: px(place.top) + 1, height: Math.max(px(place.height) - 2, 22) };
          return (
            <li key={block.key} className="absolute inset-x-1" style={style}>
              <Link
                href={block.href}
                aria-label={t('blockLabel', { title: block.title, time, status })}
                title={`${block.title} · ${time}`}
                className={cn(
                  'flex h-full min-w-0 overflow-hidden rounded-lg',
                  compact ? 'flex-col px-1.5 py-1' : 'items-center justify-between gap-2 px-2.5 py-1.5',
                  KIND_CLASS[block.kind],
                  block.past && 'opacity-55',
                  'hover:brightness-97',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className={cn('truncate font-bold text-ink', compact ? 'text-caption leading-4' : 'text-body-sm leading-5')}>
                    {compact && block.kind !== 'meeting' ? shortName(block.title) : block.title}
                  </span>
                  <span className={cn('truncate leading-4', compact ? cn('text-label', KIND_TEXT[block.kind]) : 'text-caption text-slate')}>
                    {compact ? (block.kind === 'held' ? `${clock(block.start)} · ${block.heldMinutes} min` : clock(block.start)) : time}
                  </span>
                </span>
                {compact ? null : (
                  <span className={cn('inline-block shrink-0 rounded-full bg-white px-2 py-0.5 font-label tracking-wide whitespace-nowrap', KIND_TEXT[block.kind])}>{status}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {nowLine ? (
        <span aria-hidden={true} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: px(nowLine.top) - 5 }}>
          <span className="-ml-1.5 size-2.5 shrink-0 rounded-full bg-rouge" />
          <span className="h-0.5 flex-1 bg-rouge" />
        </span>
      ) : null}
    </div>
  );
}

function Legend({ className }: { className?: string }): ReactNode {
  const t = useTranslations('Consultation.admin.calendar.legend');
  const item = (swatch: string, label: string) => (
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden={true} className={cn('size-3 rounded-sm', swatch)} />
      {label}
    </li>
  );
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-2 text-caption leading-4 text-slate', className)}>
      {item('bg-leaf', t('paid'))}
      {item('border border-dashed border-honey bg-honey-tint', t('held'))}
      {item('border border-fog bg-white', t('meeting'))}
      {item('bg-ice-blue', t('open'))}
      {item('bg-hatch-blush', t('blocked'))}
    </ul>
  );
}

/** The instant of `minutes` after midnight on `day`, Douala time (for the hour range). */
const atMinutes = (day: string, minutes: number) => new Date(startOfDay(day).getTime() + minutes * 60_000);
