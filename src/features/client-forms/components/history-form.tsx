'use client';

import { CalendarPlus, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import {
  ACTIVITY_KINDS,
  checkHistory,
  type Activity,
  type Address,
  type PersonalHistory,
} from '@/features/client-forms/lib/form-schema';
import { addMonths, compareMonths, type Month } from '@/features/client-forms/lib/periods';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none disabled:bg-off-white';
const label = 'grid gap-1 text-xs font-semibold text-slate';
const newId = () => crypto.randomUUID().slice(0, 8);

type Gap = { from: Month; to: Month };

/**
 * The Historique personnel et adresses (IRCC's Annexe A): activities and
 * addresses, each from one month to another (or « à ce jour »). Over the
 * last 10 years (or since 18) no month may be left out: the bars show the
 * window covered, each gap is named, and « Ajouter cette période » adds one
 * dated to fill it.
 */
export function HistoryForm({
  value,
  onChange,
  disabled,
  today = new Date(),
}: {
  value: PersonalHistory;
  onChange: (next: PersonalHistory) => void;
  disabled: boolean;
  today?: Date;
}): ReactNode {
  const t = useTranslations('ClientForms.history');
  const ids = useId();
  const check = checkHistory(value, today);
  const set = (patch: Partial<PersonalHistory>) => onChange({ ...value, ...patch });

  const addActivity = (period?: Gap) =>
    set({
      activities: [
        ...value.activities,
        { id: newId(), from: period?.from ?? '', to: period ? period.to : null, kind: 'work', title: '', city: '', country: '', status: '' },
      ],
    });
  const addAddress = (period?: Gap) =>
    set({
      addresses: [
        ...value.addresses,
        { id: newId(), from: period?.from ?? '', to: period ? period.to : null, line: '', city: '', province: '', postalCode: '', country: '' },
      ],
    });

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <label htmlFor={`${ids}-birth`} className={`${label} max-w-xs`}>
          {t('birthDate')}
          <input
            id={`${ids}-birth`}
            type="date"
            value={value.birthDate ?? ''}
            disabled={disabled}
            onChange={(event) => set({ birthDate: event.target.value || null })}
            className={field}
          />
        </label>
        <p className="text-sm text-slate">{t('window', { from: check.window.from, to: check.window.to })}</p>
      </section>

      <PeriodSection
        title={t('activities')}
        intro={t('activitiesIntro')}
        window={check.window}
        periods={value.activities}
        gaps={check.activityGaps}
        disabled={disabled}
        onFill={addActivity}
        addLabel={t('addActivity')}
        onAdd={() => addActivity()}
      >
        {sorted(value.activities).map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            disabled={disabled}
            onChange={(next) => set({ activities: value.activities.map((item) => (item.id === next.id ? next : item)) })}
            onRemove={() => set({ activities: value.activities.filter((item) => item.id !== activity.id) })}
          />
        ))}
      </PeriodSection>

      <PeriodSection
        title={t('addresses')}
        intro={t('addressesIntro')}
        window={check.window}
        periods={value.addresses}
        gaps={check.addressGaps}
        disabled={disabled}
        onFill={addAddress}
        addLabel={t('addAddress')}
        onAdd={() => addAddress()}
      >
        {sorted(value.addresses).map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            disabled={disabled}
            onChange={(next) => set({ addresses: value.addresses.map((item) => (item.id === next.id ? next : item)) })}
            onRemove={() => set({ addresses: value.addresses.filter((item) => item.id !== address.id) })}
          />
        ))}
      </PeriodSection>
    </div>
  );
}

/** Oldest first, the ones not dated yet at the end. */
function sorted<T extends { from: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.from) return 1;
    if (!b.from) return -1;
    return compareMonths(a.from, b.from);
  });
}

function PeriodSection({
  title,
  intro,
  window,
  periods,
  gaps,
  disabled,
  onFill,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  intro: string;
  window: Gap;
  periods: { from: string; to: string | null }[];
  gaps: Gap[];
  disabled: boolean;
  onFill: (gap: Gap) => void;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('ClientForms.history');
  const format = useFormatter();
  const monthName = (month: Month) =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const span = (gap: Gap) => (gap.from === gap.to ? monthName(gap.from) : `${monthName(gap.from)} – ${monthName(gap.to)}`);

  return (
    <section className="grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-heading text-lg font-bold text-navy-deep">{title}</h2>
        <p className="mt-1 text-sm text-slate">{intro}</p>
      </div>
      <CoverageBar window={window} gaps={gaps} />
      {gaps.length === 0 ? (
        <p className="rounded-xl bg-leaf-tint px-4 py-2.5 text-sm font-semibold text-leaf">{t('covered')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2" aria-label={t('gapsLabel')}>
          {gaps.map((gap) => (
            <li
              key={`${gap.from}-${gap.to}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose bg-blush px-4 py-2.5"
            >
              <span className="text-sm font-semibold text-crimson">{t('gap', { period: span(gap) })}</span>
              {disabled ? null : (
                <button
                  type="button"
                  onClick={() => onFill(gap)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-navy-deep hover:bg-off-white"
                >
                  <CalendarPlus aria-hidden={true} className="size-4" />
                  {t('fill')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {periods.length === 0 ? <p className="text-sm text-slate">{t('none')}</p> : <ol className="grid grid-cols-1 gap-3">{children}</ol>}
      {disabled ? null : (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
        >
          <Plus aria-hidden={true} className="size-4" />
          {addLabel}
        </button>
      )}
    </section>
  );
}

/** The window as a bar: covered months in navy, gaps in rouge, the years at each end. */
function CoverageBar({ window, gaps }: { window: Gap; gaps: Gap[] }): ReactNode {
  const total = compareMonths(window.to, window.from) + 1;
  const segments: { covered: boolean; months: number }[] = [];
  let cursor = window.from;
  for (const gap of gaps) {
    const before = compareMonths(gap.from, cursor);
    if (before > 0) segments.push({ covered: true, months: before });
    segments.push({ covered: false, months: compareMonths(gap.to, gap.from) + 1 });
    cursor = addMonths(gap.to, 1);
  }
  const after = compareMonths(window.to, cursor) + 1;
  if (after > 0) segments.push({ covered: true, months: after });

  return (
    <div aria-hidden={true}>
      <div className="flex h-3 overflow-hidden rounded-full bg-off-white">
        {segments.map((segment, index) => (
          <span
            key={index}
            className={segment.covered ? 'bg-navy-deep' : 'bg-rouge'}
            style={{ width: `${(segment.months / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate">
        <span>{window.from.slice(0, 4)}</span>
        <span>{window.to.slice(0, 4)}</span>
      </div>
    </div>
  );
}

/** From and to (or « à ce jour »), as month fields. */
function Dates({
  from,
  to,
  disabled,
  onChange,
}: {
  from: string;
  to: string | null;
  disabled: boolean;
  onChange: (next: { from: string; to: string | null }) => void;
}): ReactNode {
  const t = useTranslations('ClientForms.history');
  const ids = useId();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <label htmlFor={`${ids}-from`} className={label}>
        {t('from')}
        <input
          id={`${ids}-from`}
          type="month"
          placeholder="AAAA-MM"
          value={from}
          disabled={disabled}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className={field}
        />
      </label>
      <label htmlFor={`${ids}-to`} className={label}>
        {t('to')}
        <input
          id={`${ids}-to`}
          type="month"
          placeholder="AAAA-MM"
          value={to ?? ''}
          disabled={disabled || to === null}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className={field}
        />
      </label>
      <label htmlFor={`${ids}-now`} className="col-span-2 flex items-center gap-2 self-end pb-3 text-sm text-navy-deep sm:col-span-1">
        <input
          id={`${ids}-now`}
          type="checkbox"
          checked={to === null}
          disabled={disabled}
          onChange={(event) => onChange({ from, to: event.target.checked ? null : '' })}
          className="size-4 accent-rouge"
        />
        {t('now')}
      </label>
    </div>
  );
}

function RemoveButton({ label: text, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }): ReactNode {
  if (disabled) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={text}
      title={text}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-rouge"
    >
      <Trash2 aria-hidden={true} className="size-4" />
    </button>
  );
}

function ActivityCard({
  activity,
  disabled,
  onChange,
  onRemove,
}: {
  activity: Activity;
  disabled: boolean;
  onChange: (next: Activity) => void;
  onRemove: () => void;
}): ReactNode {
  const t = useTranslations('ClientForms.history');
  const ids = useId();
  const set = (patch: Partial<Activity>) => onChange({ ...activity, ...patch });
  return (
    <li className="grid grid-cols-1 gap-3 rounded-xl border border-fog-light p-4">
      <div className="flex items-start gap-2">
        <label htmlFor={`${ids}-kind`} className={`${label} flex-1`}>
          {t('kind')}
          <select
            id={`${ids}-kind`}
            value={activity.kind}
            disabled={disabled}
            onChange={(event) => set({ kind: event.target.value as Activity['kind'] })}
            className={field}
          >
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <RemoveButton label={t('remove')} onClick={onRemove} disabled={disabled} />
      </div>
      <Dates from={activity.from} to={activity.to} disabled={disabled} onChange={(dates) => set(dates)} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(['title', 'status', 'city', 'country'] as const).map((key) => (
          <label key={key} htmlFor={`${ids}-${key}`} className={label}>
            {t(`fields.${key}`)}
            <input
              id={`${ids}-${key}`}
              value={activity[key]}
              maxLength={200}
              disabled={disabled}
              onChange={(event) => set({ [key]: event.target.value })}
              className={field}
            />
          </label>
        ))}
      </div>
    </li>
  );
}

function AddressCard({
  address,
  disabled,
  onChange,
  onRemove,
}: {
  address: Address;
  disabled: boolean;
  onChange: (next: Address) => void;
  onRemove: () => void;
}): ReactNode {
  const t = useTranslations('ClientForms.history');
  const ids = useId();
  const set = (patch: Partial<Address>) => onChange({ ...address, ...patch });
  return (
    <li className="grid grid-cols-1 gap-3 rounded-xl border border-fog-light p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Dates from={address.from} to={address.to} disabled={disabled} onChange={(dates) => set(dates)} />
        </div>
        <RemoveButton label={t('remove')} onClick={onRemove} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(['line', 'city', 'province', 'postalCode', 'country'] as const).map((key) => (
          <label key={key} htmlFor={`${ids}-${key}`} className={`${label} ${key === 'line' ? 'sm:col-span-2' : ''}`}>
            {t(`fields.${key}`)}
            <input
              id={`${ids}-${key}`}
              value={address[key]}
              maxLength={key === 'postalCode' ? 20 : 200}
              disabled={disabled}
              onChange={(event) => set({ [key]: event.target.value })}
              className={field}
            />
          </label>
        ))}
      </div>
    </li>
  );
}
