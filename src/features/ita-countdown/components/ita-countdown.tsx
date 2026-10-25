'use client';

import { CalendarDays, TriangleAlert } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';

import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { CountdownRing } from '@/features/ita-countdown/components/countdown-ring';
import { RecentDrawsPicker } from '@/features/ita-countdown/components/recent-draws-picker';
import { itaDeadline, timeLeft, utcDate, utcToday } from '@/features/ita-countdown/lib/ita-deadline';
import { URGENCY_CLASSES, urgencyOf } from '@/features/ita-countdown/lib/urgency';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';
import { Link } from '@/i18n/navigation';
import { api } from '@/trpc/react';

/** The ITA date, kept in this browser between visits. */
export const ITA_DATE_KEY = 'stanzy.ita-countdown.v1';
const storedSchema = z.object({ itaDay: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/) });

const pad = (n: number) => String(n).padStart(2, '0');

/** The date of the signed-in User's latest ITA Étape, or null (signed out, or none logged). */
function useParcoursIta(): string | null {
  const { account } = useCurrentAccount();
  const { data: etapes } = api.parcours.list.useQuery(undefined, { enabled: account !== null });
  const itas = (etapes ?? []).filter((etape) => etape.code === 'ITA').map((etape) => etape.date);
  return itas.length > 0 ? itas.reduce((latest, day) => (day > latest ? day : latest)) : null;
}

/** The countdown itself: the ITA date in, the time left and the deadline out. */
export function ItaCountdown(): ReactNode {
  const t = useTranslations('ItaCountdown');
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const [stored, store] = useStoredForm(ITA_DATE_KEY, storedSchema, { itaDay: '' });
  const parcoursIta = useParcoursIta();
  // The Parcours is the signed-in User's record of their ITA, so it wins over
  // a date kept in this browser, until they type another one here.
  const [typed, setTyped] = useState(false);
  const fromParcours = !typed && parcoursIta !== null;
  const itaDay = fromParcours ? parcoursIta : stored.itaDay;
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
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <CountdownRing left={left} />

      {urgency && (
        // Classes joined by hand here and below: `cn` drops custom sizes (text-body-sm, text-h3) next to a colour.
        <p role="status" className={`text-center text-body-sm font-semibold ${URGENCY_CLASSES[urgency].text}`}>
          {t(`urgency.${urgency}`)}
        </p>
      )}

      {running && (
        <section aria-labelledby="ita-time-left" className="grid grid-cols-4 gap-2.5">
          <h2 id="ita-time-left" className="sr-only">
            {t('timeLeft.title')}
          </h2>
          {(
            [
              [running.days, 'days'],
              [running.hours, 'hours'],
              [running.minutes, 'minutes'],
              [running.seconds, 'seconds'],
            ] as const
          ).map(([value, unit]) => (
            <div key={unit} className="rounded-2xl border-2 border-fog-light bg-off-white px-1 pt-4 pb-3 text-center">
              <strong
                className={`block font-heading text-2xl font-bold leading-none sm:text-h3 ${
                  unit === 'days' && urgency ? URGENCY_CLASSES[urgency].text : 'text-navy-deep'
                }`}
              >
                {pad(value)}
              </strong>
              <span className="mt-1.5 block font-label uppercase tracking-widest text-slate">{t(`timeLeft.${unit}`)}</span>
            </div>
          ))}
        </section>
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
          className="flex items-start gap-3 rounded-2xl border border-rose bg-blush px-4.5 py-3.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rouge text-white">
            <CalendarDays aria-hidden={true} className="size-4.5" />
          </span>
          <div>
            <h2 id="ita-deadline" className="font-label font-semibold uppercase tracking-widest text-rouge/70">
              {t('deadline.title')}
            </h2>
            <p className="mt-1 font-heading text-body font-bold text-rouge">
              {t('deadline.lastDay', { date: longDate(utcDate(deadline.lastDay)) })}
            </p>
            <p className="text-caption text-rouge/80">
              {t('deadline.closes', { date: longDate(deadline.closesAt) })}{' '}
              {t('deadline.local', {
                time: format.dateTime(deadline.closesAt, {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
            <p className="mt-2 text-caption text-slate">{t('deadline.check')}</p>
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

      {!itaDay && <p className="text-center text-body-sm text-slate">{t('empty')}</p>}
    </div>
  );
}
