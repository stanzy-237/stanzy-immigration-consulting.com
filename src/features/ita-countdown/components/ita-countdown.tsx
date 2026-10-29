'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, TriangleAlert } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';

import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { FlipTile } from '@/features/ita-countdown/components/flip-tile';
import { RecentDrawsPicker } from '@/features/ita-countdown/components/recent-draws-picker';
import { ITA_WINDOW_DAYS, itaDeadline, timeLeft, utcDate, utcToday, type TimeLeft } from '@/features/ita-countdown/lib/ita-deadline';
import { URGENCY_CLASSES, urgencyOf } from '@/features/ita-countdown/lib/urgency';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/** The ITA date, kept in this browser between visits. */
export const ITA_DATE_KEY = 'stanzy.ita-countdown.v1';
const storedSchema = z.object({ itaDay: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/) });

const pad = (n: number) => String(n).padStart(2, '0');

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

/** Days, hours, minutes and seconds as flip-clock tiles; the days tile can wear the urgency ring. */
function FlipBoard({
  left,
  daysRing,
}: {
  left: Pick<TimeLeft, (typeof UNITS)[number]>;
  daysRing?: string;
}): ReactNode {
  const t = useTranslations('ItaCountdown.timeLeft');
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {UNITS.map((unit) => (
        <div key={unit} className="flex flex-col items-center gap-2">
          <FlipTile
            text={pad(left[unit])}
            className={`w-full ${unit === 'days' && daysRing ? `ring-4 ring-offset-2 ring-offset-off-white ${daysRing}` : ''}`}
          />
          <span className="font-label uppercase tracking-widest text-slate">{t(unit)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The date of the signed-in User's latest ITA Étape (null when signed out or
 * none is logged), and whether that is still being looked up.
 */
function useParcoursIta(): { day: string | null; loading: boolean } {
  const { account, pending } = useCurrentAccount();
  const trpc = useTRPC();
  // Private data on a static page: read in the browser, never prefetched.
  const { data: etapes, isPending } = useQuery(trpc.parcours.list.queryOptions(undefined, { enabled: account !== null }));
  const itas = (etapes ?? []).filter((etape) => etape.code === 'ITA').map((etape) => etape.date);
  return {
    day: itas.length > 0 ? itas.reduce((latest, day) => (day > latest ? day : latest)) : null,
    loading: pending || (account !== null && isPending),
  };
}

/** The countdown itself: the ITA date in, the time left and the deadline out. */
export function ItaCountdown(): ReactNode {
  const t = useTranslations('ItaCountdown');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const [stored, store] = useStoredForm(ITA_DATE_KEY, storedSchema, { itaDay: '' });
  const parcoursIta = useParcoursIta();
  // The Parcours is the signed-in User's record of their ITA, so it wins over
  // a date kept in this browser, until they type another one here. While it
  // loads, nothing is counted rather than a date about to be replaced.
  const [typed, setTyped] = useState(false);
  const waiting = !typed && parcoursIta.loading;
  const fromParcours = !typed && parcoursIta.day !== null;
  const itaDay = waiting ? '' : fromParcours ? (parcoursIta.day ?? '') : stored.itaDay;
  const setItaDay = (day: string) => {
    setTyped(true);
    store({ itaDay: day });
  };

  const today = utcToday(now);
  const inFuture = itaDay > today;
  const deadline = itaDay && !inFuture ? itaDeadline(itaDay) : null;
  const left = deadline ? timeLeft(deadline.closesAt, now) : null;
  const running = left && !left.expired ? left : null;
  const urgency = running ? urgencyOf(running.days) : null;
  const percentLeft = running ? Math.round(running.share * 100) : 0;
  const longDate = (date: Date) =>
    format.dateTime(date, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {running ? (
        <section aria-labelledby="ita-time-left">
          <h2 id="ita-time-left" className="sr-only">
            {t('timeLeft.title')}
          </h2>
          <FlipBoard left={running} daysRing={urgency ? URGENCY_CLASSES[urgency].ring : undefined} />
        </section>
      ) : (
        // Nothing to count yet (or any more): the board at rest, for the eye
        // only. It pulses, as a skeleton, while the Parcours is looked up.
        <div role={waiting ? 'status' : undefined}>
          {waiting && <span className="sr-only">{tCommon('loading')}</span>}
          <div aria-hidden={true} className={waiting ? 'animate-pulse opacity-40' : 'opacity-40'}>
            <FlipBoard left={left ?? { days: ITA_WINDOW_DAYS, hours: 0, minutes: 0, seconds: 0 }} />
          </div>
        </div>
      )}

      {urgency && (
        // Classes joined by hand here and below: `cn` drops custom sizes (text-body-sm) next to a colour.
        <p role="status" className={`text-center text-body-sm font-semibold ${URGENCY_CLASSES[urgency].text}`}>
          {t(`urgency.${urgency}`)}
        </p>
      )}

      {running && (
        <div>
          <div
            role="progressbar"
            aria-label={t('progress.name')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentLeft}
            aria-valuetext={t('progress.label', { percent: percentLeft })}
            className="h-1.5 overflow-hidden rounded-full bg-ice-blue"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-rouge to-rose transition-all duration-1000"
              style={{ width: `${percentLeft}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-caption text-slate">
            <span>{t('progress.start')}</span>
            <span>{t('progress.end')}</span>
          </div>
        </div>
      )}

      {deadline && (
        <section
          aria-labelledby="ita-deadline"
          className="rounded-2xl border border-rose bg-blush px-4 py-3.5 sm:px-4.5"
        >
          {/* The icon sits beside the title only, so on phones the details below get the full width. */}
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rouge text-white">
              <CalendarDays aria-hidden={true} className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 id="ita-deadline" className="font-label font-semibold uppercase tracking-widest text-rouge/70">
                {t('deadline.title')}
              </h2>
              <p className="font-heading text-body font-bold text-rouge">
                {t('deadline.lastDay', { date: longDate(utcDate(deadline.lastDay)) })}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-col gap-0.5 sm:pl-12">
            <p className="text-caption text-rouge/80">{t('deadline.closes', { date: longDate(deadline.closesAt) })}</p>
            <p className="text-caption text-rouge/80">
              {t('deadline.local', {
                time: format.dateTime(deadline.closesAt, {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
            <p className="mt-1.5 border-t border-rose/60 pt-2 text-caption text-slate">{t('deadline.check')}</p>
          </div>
        </section>
      )}

      {left?.expired && (
        <section role="alert" className="rounded-2xl border border-rose bg-blush p-5 text-center">
          <TriangleAlert aria-hidden={true} className="mx-auto mb-2 size-5.5 text-rouge" />
          <h2 className="mb-1.5 font-heading text-lg font-bold text-navy-deep">{t('expired.title')}</h2>
          <p className="text-body-sm text-slate">{t('expired.text')}</p>
        </section>
      )}

      <div>
        <label htmlFor="ita-date" className="mb-2.5 block font-label font-semibold uppercase tracking-widest text-slate">
          {t('dateLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="ita-date"
            type="date"
            max={today}
            value={itaDay}
            onChange={(e) => setItaDay(e.target.value)}
            aria-invalid={inFuture ? true : undefined}
            aria-describedby={inFuture ? 'ita-date-error' : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-fog-light bg-white px-3.5 text-body text-navy-deep outline-none focus:border-rouge focus:ring-4 focus:ring-rouge/10"
          />
          <RecentDrawsPicker selected={itaDay} onPick={setItaDay} />
          {/* In the row, so they sit under the field and above the opened Tirages list. */}
          {inFuture && (
            <p id="ita-date-error" className="basis-full text-caption text-crimson">
              {t('errors.future')}
            </p>
          )}
          {fromParcours && (
            <p className="basis-full text-caption text-slate">
              {t('fromParcours')}{' '}
              <Link href="/outils/timeline" className="font-semibold text-rouge underline-offset-2 hover:underline">
                {t('openParcours')}
              </Link>
            </p>
          )}
        </div>
      </div>

      {!itaDay && !waiting && <p className="text-center text-body-sm text-slate">{t('empty')}</p>}
    </div>
  );
}
