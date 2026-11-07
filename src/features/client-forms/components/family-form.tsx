'use client';

import { Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { familyMissing, MARITAL, RELATIONS, type Family, type Member } from '@/features/client-forms/lib/form-schema';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none disabled:bg-off-white';
const label = 'grid gap-1 text-xs font-semibold text-slate';
const newId = () => crypto.randomUUID().slice(0, 8);

/** IRCC's order on the IMM 5406. */
const ORDER: Record<Member['relation'], number> = { applicant: 0, spouse: 1, child: 2, mother: 3, father: 4, sibling: 5 };
/** Those there is only one of. */
const SINGLE: Member['relation'][] = ['applicant', 'spouse', 'mother', 'father'];

const blank = (relation: Member['relation']): Member => ({
  id: newId(),
  relation,
  name: '',
  birthDate: null,
  birthCountry: '',
  maritalStatus: null,
  address: '',
  occupation: '',
  deceased: false,
  deathDate: null,
  deathPlace: '',
  accompanying: relation === 'applicant',
});

/**
 * The Renseignements sur la famille (IRCC's IMM 5406): the applicant, the
 * spouse, every child (adult or married too), both parents and every
 * sibling, each with a birth date, a birth country, a marital status and an
 * address, or for someone who died, the date and the place.
 */
export function FamilyForm({
  value,
  onChange,
  disabled,
}: {
  value: Family;
  onChange: (next: Family) => void;
  disabled: boolean;
}): ReactNode {
  const t = useTranslations('ClientForms.family');
  const missing = familyMissing(value);
  const members = [...value.members].sort((a, b) => ORDER[a.relation] - ORDER[b.relation]);
  const add = (relation: Member['relation']) => onChange({ members: [...value.members, blank(relation)] });
  const canAdd = (relation: Member['relation']) =>
    !SINGLE.includes(relation) || !value.members.some((person) => person.relation === relation);

  return (
    <div className="grid grid-cols-1 gap-6">
      {missing.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1 rounded-2xl border border-rose bg-blush px-5 py-4 text-sm text-crimson">
          {missing.map((what) => (
            <li key={what}>• {t(`missing.${what}`)}</li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-leaf-tint px-5 py-3 text-sm font-semibold text-leaf">{t('complete')}</p>
      )}

      {members.length === 0 ? null : (
        <ol className="grid grid-cols-1 gap-4">
          {members.map((person) => (
            <MemberCard
              key={person.id}
              person={person}
              disabled={disabled}
              onChange={(next) => onChange({ members: value.members.map((item) => (item.id === next.id ? next : item)) })}
              onRemove={() => onChange({ members: value.members.filter((item) => item.id !== person.id) })}
            />
          ))}
        </ol>
      )}

      {disabled ? null : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {RELATIONS.filter(canAdd).map((relation) => (
            <button
              key={relation}
              type="button"
              onClick={() => add(relation)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold whitespace-nowrap text-navy-deep hover:bg-navy-deep hover:text-white"
            >
              <UserPlus aria-hidden={true} className="size-4" />
              {t(`add.${relation}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  person,
  disabled,
  onChange,
  onRemove,
}: {
  person: Member;
  disabled: boolean;
  onChange: (next: Member) => void;
  onRemove: () => void;
}): ReactNode {
  const t = useTranslations('ClientForms.family');
  const ids = useId();
  const set = (patch: Partial<Member>) => onChange({ ...person, ...patch });
  const input = (key: 'name' | 'birthCountry' | 'address' | 'occupation' | 'deathPlace', wide = false) => (
    <label htmlFor={`${ids}-${key}`} className={`${label} ${wide ? 'sm:col-span-2' : ''}`}>
      {t(`fields.${key}`)}
      <input
        id={`${ids}-${key}`}
        value={person[key]}
        maxLength={200}
        disabled={disabled}
        onChange={(event) => set({ [key]: event.target.value })}
        className={field}
      />
    </label>
  );
  const date = (key: 'birthDate' | 'deathDate') => (
    <label htmlFor={`${ids}-${key}`} className={label}>
      {t(`fields.${key}`)}
      <input
        id={`${ids}-${key}`}
        type="date"
        value={person[key] ?? ''}
        disabled={disabled}
        onChange={(event) => set({ [key]: event.target.value || null })}
        className={field}
      />
    </label>
  );

  return (
    <li className="grid grid-cols-1 gap-3 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="rounded-full bg-ice-blue px-3 py-1 text-xs font-bold tracking-wider text-navy-deep uppercase">
          {t(`relations.${person.relation}`)}
        </p>
        {disabled || person.relation === 'applicant' ? null : (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('remove')}
            title={t('remove')}
            className="inline-flex size-9 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-rouge"
          >
            <Trash2 aria-hidden={true} className="size-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {input('name', true)}
        {date('birthDate')}
        {input('birthCountry')}
        <label htmlFor={`${ids}-marital`} className={label}>
          {t('fields.maritalStatus')}
          <select
            id={`${ids}-marital`}
            value={person.maritalStatus ?? ''}
            disabled={disabled}
            onChange={(event) => set({ maritalStatus: (event.target.value || null) as Member['maritalStatus'] })}
            className={field}
          >
            <option value="">{t('choose')}</option>
            {MARITAL.map((status) => (
              <option key={status} value={status}>
                {t(`marital.${status}`)}
              </option>
            ))}
          </select>
        </label>
        {input('occupation')}
        {person.deceased ? null : input('address', true)}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label htmlFor={`${ids}-deceased`} className="flex items-center gap-2 text-sm text-navy-deep">
          <input
            id={`${ids}-deceased`}
            type="checkbox"
            checked={person.deceased}
            disabled={disabled || person.relation === 'applicant'}
            onChange={(event) => set({ deceased: event.target.checked, accompanying: false })}
            className="size-4 accent-rouge"
          />
          {t('deceased')}
        </label>
        {person.deceased ? null : (
          <label htmlFor={`${ids}-accompanying`} className="flex items-center gap-2 text-sm text-navy-deep">
            <input
              id={`${ids}-accompanying`}
              type="checkbox"
              checked={person.accompanying}
              disabled={disabled}
              onChange={(event) => set({ accompanying: event.target.checked })}
              className="size-4 accent-rouge"
            />
            {t('accompanying')}
          </label>
        )}
      </div>
      {person.deceased ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {date('deathDate')}
          {input('deathPlace')}
        </div>
      ) : null}
    </li>
  );
}
