'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import {
  AREA_ANSWERS,
  AREAS,
  CNP_PATTERN,
  COMPANY_MAX,
  COUNTRY_MAX,
  experienceSchema,
  LANGUAGE_TESTS,
  NOTE_MAX,
  PHONE_MAX,
  progressSchema,
  RESIDENCES,
  workSchema,
  type Area,
  type CorrectedAnswers,
  type Experience,
  type InterestAnswers,
  type Progress,
} from '@/features/accompagnement/lib/interest-schema';
import { MAX_CHILDREN, MAX_ENTRIES } from '@/features/checklist/lib/checklist-form';
import { MARITAL_STATUSES } from '@/features/shared/lib/marital-status';
import { useTRPC } from '@/trpc/client';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';

/** Whatever a correction needs: the answers as they stand, the Client's own, and the save. */
type Correction = {
  answers: InterestAnswers;
  original: InterestAnswers | null;
  editable: boolean;
  pending: boolean;
  save: (next: InterestAnswers) => Promise<boolean>;
};
const CorrectionContext = createContext<Correction | null>(null);
const useCorrection = (): Correction => useContext(CorrectionContext)!;

/** The answers as the server takes them: the CRS answers without their score, only the jobs filled in. */
const toCorrection = ({ crs, work, ...answers }: InterestAnswers): CorrectedAnswers => ({
  ...answers,
  ...(crs ? { crs: crs.profile } : {}),
  ...(work ? { work: { ...work, experiences: work.experiences.filter((job) => job.company.trim() !== '') } } : {}),
});

/**
 * A Demande's answers (#81), each with a pencil for the consultant to
 * correct that one answer (#154), before deciding or once accepted. Where
 * a correction changed it, the Client's own answer shows under it.
 */
export function InterestAnswers({
  interest,
  editable,
}: {
  interest: { id: string; answers: InterestAnswers; originalAnswers: InterestAnswers | null };
  editable: boolean;
}): ReactNode {
  const t = useTranslations('Accompagnement');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const update = useMutation(trpc.accompagnement.dashboard.updateAnswers.mutationOptions());
  const save = async (next: InterestAnswers) => {
    try {
      await update.mutateAsync({ id: interest.id, answers: toCorrection(next) });
      await queryClient.invalidateQueries({ queryKey: trpc.accompagnement.dashboard.pathKey() });
      toast.add({ title: t('dashboard.edit.saved'), type: 'success' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const known = t.has(`errors.${message}`);
      toast.add({ title: t(known ? `errors.${message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      return false;
    }
  };

  return (
    <CorrectionContext.Provider
      value={{ answers: interest.answers, original: interest.originalAnswers, editable, pending: update.isPending, save }}
    >
      <Answers />
    </CorrectionContext.Provider>
  );
}

function Answers(): ReactNode {
  const t = useTranslations('Accompagnement');
  const family = useTranslations('Calculators.family');
  const { answers } = useCorrection();
  const yes = (value: boolean) => (value ? t('dashboard.yes') : t('dashboard.no'));
  const set = <K extends keyof Progress>(key: K) => (current: InterestAnswers, value: Progress[K]) => ({
    ...current,
    progress: { ...current.progress, [key]: value },
  });
  const setChecklist =
    <K extends keyof InterestAnswers['checklist']>(key: K) =>
    (current: InterestAnswers, value: InterestAnswers['checklist'][K]) => ({
      ...current,
      checklist: { ...current.checklist, [key]: value },
    });

  return (
    <>
      <Section id="progress" title={t('dashboard.progress')}>
        <Row
          term={t('form.age')}
          show={(a) => String(a.progress.age)}
          edit={(close) => (
            <TextEdit
              label={t('form.age')}
              initial={String(answers.progress.age)}
              inputMode="numeric"
              close={close}
              apply={(current, value) => {
                const age = Number(value);
                return progressSchema.shape.age.safeParse(age).success ? set('age')(current, age) : null;
              }}
            />
          )}
        />
        <Row
          term={t('form.citizenship')}
          show={(a) => a.progress.citizenship}
          edit={(close) => (
            <TextEdit
              label={t('form.citizenship')}
              initial={answers.progress.citizenship}
              maxLength={COUNTRY_MAX}
              close={close}
              apply={(current, value) => (value.trim().length >= 2 ? set('citizenship')(current, value.trim()) : null)}
            />
          )}
        />
        <Row
          term={t('form.residence')}
          show={(a) =>
            a.progress.residence === 'OTHER' ? a.progress.residenceOther : t(`form.residences.${a.progress.residence}`)
          }
          edit={(close) => <ResidenceEdit close={close} />}
        />
        <Row
          term={t('form.languageTest')}
          show={(a) => t(`form.languageTests.${a.progress.languageTest}`)}
          edit={(close) => (
            <SelectEdit
              label={t('form.languageTest')}
              initial={answers.progress.languageTest}
              options={LANGUAGE_TESTS.map((test) => [test, t(`form.languageTests.${test}`)])}
              close={close}
              apply={(current, value) => set('languageTest')(current, value as Progress['languageTest'])}
            />
          )}
        />
        <Row
          term={t('form.ede')}
          show={(a) => yes(a.progress.ede)}
          edit={(close) => (
            <YesNoEdit label={t('form.ede')} initial={answers.progress.ede} close={close} apply={set('ede')} />
          )}
        />
        <Row
          term={t('form.eeProfile')}
          show={(a) => yes(a.progress.eeProfile)}
          edit={(close) => (
            <YesNoEdit
              label={t('form.eeProfile')}
              initial={answers.progress.eeProfile}
              close={close}
              // No ITA without a profile.
              apply={(current, eeProfile) => ({
                ...current,
                progress: {
                  ...current.progress,
                  eeProfile,
                  ita: eeProfile && current.progress.ita,
                  itaDate: eeProfile ? current.progress.itaDate : null,
                },
              })}
            />
          )}
        />
        <Row
          term={t('form.ita')}
          show={(a) => (a.progress.ita ? `${yes(true)}${a.progress.itaDate ? ` · ${a.progress.itaDate}` : ''}` : yes(false))}
          edit={answers.progress.eeProfile ? (close) => <ItaEdit close={close} /> : undefined}
        />
        {answers.crs ? <Row term={t('dashboard.crs')} show={(a) => String(a.crs?.total ?? '')} /> : null}
      </Section>

      <Section id="work" title={t('dashboard.work')}>
        <Row
          term={t('form.work.phone')}
          show={(a) => a.work?.phone || t('dashboard.edit.notFilled')}
          edit={(close) => (
            <TextEdit
              label={t('form.work.phone')}
              initial={answers.work?.phone ?? ''}
              type="tel"
              maxLength={PHONE_MAX}
              close={close}
              apply={(current, phone) =>
                workSchema.shape.phone.safeParse(phone).success
                  ? { ...current, work: { experiences: [], ...current.work, phone: phone.trim() } }
                  : null
              }
            />
          )}
        />
        {answers.checklist.jobs.map((job) => (
          <Row
            key={job.title}
            term={job.title}
            show={(a) => {
              const experience = a.work?.experiences.find((one) => one.title === job.title);
              return experience
                ? `${experience.company} · ${t('dashboard.cnp', { code: experience.cnp })} · ${t('dashboard.period', {
                    start: experience.startOn,
                    end: experience.endOn ?? t('dashboard.current'),
                  })}`
                : t('dashboard.edit.notFilled');
            }}
            edit={(close) => <JobEdit title={job.title} close={close} />}
          />
        ))}
      </Section>

      <Section id="situation" title={t('dashboard.situation')}>
        <Row
          term={t('dashboard.maritalStatus')}
          show={(a) => family(`maritalOptions.${a.checklist.maritalStatus}`)}
          edit={(close) => (
            <SelectEdit
              label={t('dashboard.maritalStatus')}
              initial={answers.checklist.maritalStatus}
              options={MARITAL_STATUSES.map((status) => [status, family(`maritalOptions.${status}`)])}
              close={close}
              apply={(current, value) =>
                setChecklist('maritalStatus')(current, value as InterestAnswers['checklist']['maritalStatus'])
              }
            />
          )}
        />
        <Row
          term={t('dashboard.spouseAccompanying')}
          show={(a) => yes(a.checklist.spouseAccompanying)}
          edit={(close) => (
            <YesNoEdit
              label={t('dashboard.spouseAccompanying')}
              initial={answers.checklist.spouseAccompanying}
              close={close}
              apply={setChecklist('spouseAccompanying')}
            />
          )}
        />
        <Row
          term={t('dashboard.children')}
          show={(a) => String(a.checklist.children)}
          edit={(close) => (
            <TextEdit
              label={t('dashboard.children')}
              initial={String(answers.checklist.children)}
              inputMode="numeric"
              close={close}
              apply={(current, value) => {
                const children = Number(value);
                return Number.isInteger(children) && children >= 0 && children <= MAX_CHILDREN
                  ? setChecklist('children')(current, children)
                  : null;
              }}
            />
          )}
        />
        <Row
          term={t('dashboard.foreignEducation')}
          show={(a) => yes(a.checklist.foreignEducation)}
          edit={(close) => (
            <YesNoEdit
              label={t('dashboard.foreignEducation')}
              initial={answers.checklist.foreignEducation}
              close={close}
              apply={setChecklist('foreignEducation')}
            />
          )}
        />
        <Row
          term={t('dashboard.canadianEducation')}
          show={(a) => yes(a.checklist.canadianEducation)}
          edit={(close) => (
            <YesNoEdit
              label={t('dashboard.canadianEducation')}
              initial={answers.checklist.canadianEducation}
              close={close}
              apply={setChecklist('canadianEducation')}
            />
          )}
        />
        <Row
          term={t('dashboard.jobs')}
          show={(a) => a.checklist.jobs.map((one) => one.title).join(', ')}
          edit={(close) => (
            <ListEdit
              label={t('dashboard.jobs')}
              initial={answers.checklist.jobs.map((one) => one.title)}
              close={close}
              apply={renameJobs}
            />
          )}
        />
        <Row
          term={t('dashboard.countries')}
          show={(a) => a.checklist.countries.join(', ')}
          edit={(close) => (
            <ListEdit
              label={t('dashboard.countries')}
              initial={answers.checklist.countries}
              close={close}
              apply={(current, countries) => setChecklist('countries')(current, countries)}
            />
          )}
        />
      </Section>

      <Section id="documents" title={t('dashboard.documents')}>
        {AREAS.map((area) => (
          <Row
            key={area}
            term={t(`form.areas.${area}`)}
            show={(a) =>
              `${t(`form.answers.${a.areas[area].answer}`)}${a.areas[area].note ? ` · ${a.areas[area].note}` : ''}`
            }
            render={(a) => (
              <>
                <span
                  className={
                    a.areas[area].answer === 'have'
                      ? 'rounded-full bg-leaf-tint px-2 py-0.5 text-xs font-semibold text-leaf'
                      : 'rounded-full bg-honey-tint px-2 py-0.5 text-xs font-semibold text-honey'
                  }
                >
                  {t(`form.answers.${a.areas[area].answer}`)}
                </span>
                {a.areas[area].note ? <span className="mt-0.5 block text-slate">{a.areas[area].note}</span> : null}
              </>
            )}
            edit={(close) => <AreaEdit area={area} close={close} />}
          />
        ))}
      </Section>
    </>
  );
}

/** Renames, adds or removes jobs by position; each job's details follow its new name, a removed one's go. */
function renameJobs(current: InterestAnswers, titles: string[]): InterestAnswers {
  const jobs = titles.map((title, index) => ({
    ...(current.checklist.jobs[index] ?? { inCanada: false, selfEmployed: false }),
    title,
  }));
  const renamed = new Map(current.checklist.jobs.map((job, index) => [job.title, titles[index]]));
  const experiences = (current.work?.experiences ?? []).flatMap((experience) => {
    const title = renamed.get(experience.title);
    return title ? [{ ...experience, title }] : [];
  });
  return {
    ...current,
    checklist: { ...current.checklist, jobs },
    ...(current.work ? { work: { ...current.work, experiences } } : {}),
  };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactNode {
  return (
    <section aria-labelledby={`interest-${id}`} className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <h2 id={`interest-${id}`} className="mb-3 font-heading text-lg font-bold text-navy-deep">
        {title}
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** One answer: its value, a pencil to correct it, and the Client's own when it was changed. */
function Row({
  term,
  show,
  render,
  edit,
}: {
  term: string;
  /** The answer in words: what shows, and what tells a correction from the Client's own. */
  show: (answers: InterestAnswers) => string;
  /** How the answer shows, when not as plain words. */
  render?: (answers: InterestAnswers) => ReactNode;
  edit?: (close: () => void) => ReactNode;
}): ReactNode {
  const t = useTranslations('Accompagnement.dashboard.edit');
  const { answers, original, editable } = useCorrection();
  const [editing, setEditing] = useState(false);
  const value = show(answers);
  const declared = original ? show(original) : value;

  return (
    <div className={editing ? 'sm:col-span-2' : undefined}>
      <dt className="flex items-center gap-1 text-xs font-semibold text-slate">
        {term}
        {editable && edit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t('editLabel', { field: term })}
            className="inline-flex size-8 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-navy-deep"
          >
            <Pencil aria-hidden={true} className="size-3.5" />
          </button>
        ) : null}
      </dt>
      <dd className="text-navy-deep">
        {editing && edit ? edit(() => setEditing(false)) : render ? render(answers) : value}
        {declared !== value ? (
          <span className="mt-0.5 block text-xs text-slate">{t('client', { value: declared })}</span>
        ) : null}
      </dd>
    </div>
  );
}

/** A small form for one answer: `submit` gives the corrected answers, or null when the value is wrong. */
function EditForm({
  close,
  submit,
  children,
}: {
  close: () => void;
  submit: (current: InterestAnswers) => InterestAnswers | null;
  children: (invalid: boolean) => ReactNode;
}): ReactNode {
  const t = useTranslations('Accompagnement.dashboard.edit');
  const { answers, save, pending } = useCorrection();
  const [invalid, setInvalid] = useState(false);
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = submit(answers);
    setInvalid(next === null);
    if (next && (await save(next))) close();
  };
  return (
    <form onSubmit={onSubmit} noValidate className="mt-1 grid grid-cols-1 gap-2 rounded-xl bg-off-white p-3">
      {children(invalid)}
      {invalid ? (
        <p role="alert" className="text-sm text-rouge">
          {t('invalid')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={close}
          className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

function TextEdit({
  label,
  initial,
  close,
  apply,
  inputMode,
  type = 'text',
  maxLength = 200,
}: {
  label: string;
  initial: string;
  close: () => void;
  apply: (current: InterestAnswers, value: string) => InterestAnswers | null;
  inputMode?: 'numeric';
  type?: 'text' | 'tel';
  maxLength?: number;
}): ReactNode {
  const id = useId();
  const [value, setValue] = useState(initial);
  return (
    <EditForm close={close} submit={(current) => apply(current, value)}>
      {(invalid) => (
        <input
          id={id}
          aria-label={label}
          autoFocus={true}
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          aria-invalid={invalid}
          onChange={(event) => setValue(event.target.value)}
          className={field}
        />
      )}
    </EditForm>
  );
}

function SelectEdit({
  label,
  initial,
  options,
  close,
  apply,
}: {
  label: string;
  initial: string;
  options: [string, string][];
  close: () => void;
  apply: (current: InterestAnswers, value: string) => InterestAnswers | null;
}): ReactNode {
  const [value, setValue] = useState(initial);
  return (
    <EditForm close={close} submit={(current) => apply(current, value)}>
      {() => (
        <select
          aria-label={label}
          autoFocus={true}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={field}
        >
          {options.map(([option, name]) => (
            <option key={option} value={option}>
              {name}
            </option>
          ))}
        </select>
      )}
    </EditForm>
  );
}

function YesNoEdit({
  label,
  initial,
  close,
  apply,
}: {
  label: string;
  initial: boolean;
  close: () => void;
  apply: (current: InterestAnswers, value: boolean) => InterestAnswers | null;
}): ReactNode {
  const t = useTranslations('Accompagnement.dashboard');
  const name = useId();
  const [value, setValue] = useState(initial);
  return (
    <EditForm close={close} submit={(current) => apply(current, value)}>
      {() => (
        <div role="radiogroup" aria-label={label} className="flex gap-2">
          {[true, false].map((choice) => (
            <label
              key={String(choice)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep has-checked:border-navy-deep"
            >
              <input
                type="radio"
                name={name}
                checked={value === choice}
                onChange={() => setValue(choice)}
                className="accent-rouge"
              />
              {choice ? t('yes') : t('no')}
            </label>
          ))}
        </div>
      )}
    </EditForm>
  );
}

/** The country of residence; away from Cameroon, « Stanzy s'en charge » goes back to « Je ne l'ai pas ». */
function ResidenceEdit({ close }: { close: () => void }): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const { answers } = useCorrection();
  const [residence, setResidence] = useState(answers.progress.residence);
  const [other, setOther] = useState(answers.progress.residenceOther);
  return (
    <EditForm
      close={close}
      submit={(current) => {
        if (residence === 'OTHER' && other.trim().length < 2) return null;
        const areas = Object.fromEntries(
          AREAS.map((area) => [
            area,
            residence !== 'CM' && current.areas[area].answer === 'stanzy'
              ? { ...current.areas[area], answer: 'missing' }
              : current.areas[area],
          ]),
        ) as InterestAnswers['areas'];
        return {
          ...current,
          areas,
          progress: { ...current.progress, residence, residenceOther: residence === 'OTHER' ? other.trim() : '' },
        };
      }}
    >
      {(invalid) => (
        <>
          <select
            aria-label={t('residence')}
            autoFocus={true}
            value={residence}
            onChange={(event) => setResidence(event.target.value as Progress['residence'])}
            className={field}
          >
            {RESIDENCES.map((option) => (
              <option key={option} value={option}>
                {t(`residences.${option}`)}
              </option>
            ))}
          </select>
          {residence === 'OTHER' ? (
            <input
              aria-label={t('residenceOther')}
              value={other}
              maxLength={COUNTRY_MAX}
              aria-invalid={invalid}
              onChange={(event) => setOther(event.target.value)}
              className={field}
            />
          ) : null}
        </>
      )}
    </EditForm>
  );
}

/** Whether an ITA came, and when. */
function ItaEdit({ close }: { close: () => void }): ReactNode {
  const t = useTranslations('Accompagnement');
  const name = useId();
  const { answers } = useCorrection();
  const [ita, setIta] = useState(answers.progress.ita);
  const [date, setDate] = useState(answers.progress.itaDate ?? '');
  return (
    <EditForm
      close={close}
      submit={(current) => ({ ...current, progress: { ...current.progress, ita, itaDate: ita && date ? date : null } })}
    >
      {() => (
        <>
          <div role="radiogroup" aria-label={t('form.ita')} className="flex gap-2">
            {[true, false].map((choice) => (
              <label
                key={String(choice)}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep has-checked:border-navy-deep"
              >
                <input type="radio" name={name} checked={ita === choice} onChange={() => setIta(choice)} className="accent-rouge" />
                {choice ? t('dashboard.yes') : t('dashboard.no')}
              </label>
            ))}
          </div>
          {ita ? (
            <input
              type="date"
              aria-label={t('form.itaDate')}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={field}
            />
          ) : null}
        </>
      )}
    </EditForm>
  );
}

/** A list of names (jobs, countries), at least one. */
function ListEdit({
  label,
  initial,
  close,
  apply,
}: {
  label: string;
  initial: string[];
  close: () => void;
  apply: (current: InterestAnswers, values: string[]) => InterestAnswers | null;
}): ReactNode {
  const t = useTranslations('Accompagnement.dashboard.edit');
  const [values, setValues] = useState(initial);
  return (
    <EditForm
      close={close}
      submit={(current) => {
        const named = values.map((value) => value.trim());
        return named.length > 0 && named.every((value) => value.length > 0) ? apply(current, named) : null;
      }}
    >
      {(invalid) => (
        <>
          {values.map((value, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={t('item', { field: label, n: index + 1 })}
                value={value}
                maxLength={80}
                aria-invalid={invalid && value.trim() === ''}
                onChange={(event) => setValues(values.map((other, at) => (at === index ? event.target.value : other)))}
                className={field}
              />
              {values.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setValues(values.filter((_, at) => at !== index))}
                  aria-label={t('remove', { item: value || t('item', { field: label, n: index + 1 }) })}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate hover:bg-white hover:text-rouge"
                >
                  <Trash2 aria-hidden={true} className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          {values.length < MAX_ENTRIES ? (
            <button
              type="button"
              onClick={() => setValues([...values, ''])}
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
            >
              <Plus aria-hidden={true} className="size-4" />
              {t('add')}
            </button>
          ) : null}
        </>
      )}
    </EditForm>
  );
}

/** One job's company, CNP code and dates. */
function JobEdit({ title, close }: { title: string; close: () => void }): ReactNode {
  const t = useTranslations('Accompagnement.form.work');
  const { answers } = useCorrection();
  const known = answers.work?.experiences.find((one) => one.title === title);
  const [job, setJob] = useState<Experience>(known ?? { title, company: '', cnp: '', startOn: '', endOn: null });
  const patch = (next: Partial<Experience>) => setJob((current) => ({ ...current, ...next }));
  return (
    <EditForm
      close={close}
      submit={(current) => {
        const parsed = experienceSchema.safeParse(job);
        if (!parsed.success) return null;
        const others = (current.work?.experiences ?? []).filter((one) => one.title !== title);
        const experiences = current.checklist.jobs.flatMap((one) =>
          one.title === title ? [parsed.data] : others.filter((other) => other.title === one.title),
        );
        return { ...current, work: { phone: '', ...current.work, experiences } };
      }}
    >
      {(invalid) => (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            aria-label={t('company')}
            placeholder={t('company')}
            value={job.company}
            maxLength={COMPANY_MAX}
            aria-invalid={invalid && job.company.trim().length < 2}
            onChange={(event) => patch({ company: event.target.value })}
            className={`${field} sm:col-span-2`}
          />
          <input
            aria-label={t('cnp')}
            placeholder={t('cnp')}
            inputMode="numeric"
            maxLength={5}
            value={job.cnp}
            aria-invalid={invalid && !CNP_PATTERN.test(job.cnp.trim())}
            onChange={(event) => patch({ cnp: event.target.value })}
            className={field}
          />
          <span aria-hidden={true} className="hidden sm:block" />
          <label className="grid grid-cols-1 gap-1 text-xs font-semibold text-slate">
            {t('startOn')}
            <input
              type="date"
              value={job.startOn}
              aria-invalid={invalid && job.startOn === ''}
              onChange={(event) => patch({ startOn: event.target.value })}
              className={field}
            />
          </label>
          <div className="grid grid-cols-1 gap-1">
            {job.endOn !== null ? (
              <label className="grid grid-cols-1 gap-1 text-xs font-semibold text-slate">
                {t('endOn')}
                <input
                  type="date"
                  value={job.endOn}
                  min={job.startOn || undefined}
                  aria-invalid={invalid && (job.endOn === '' || job.endOn < job.startOn)}
                  onChange={(event) => patch({ endOn: event.target.value })}
                  className={field}
                />
              </label>
            ) : null}
            <label className="flex min-h-10 items-center gap-2 text-sm text-navy-deep">
              <input
                type="checkbox"
                checked={job.endOn === null}
                onChange={(event) => patch({ endOn: event.target.checked ? null : '' })}
                className="size-5 accent-rouge"
              />
              {t('current')}
            </label>
          </div>
        </div>
      )}
    </EditForm>
  );
}

/** A document area's answer and note; « Stanzy s'en charge » from Cameroon only. */
function AreaEdit({ area, close }: { area: Area; close: () => void }): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const { answers } = useCorrection();
  const [answer, setAnswer] = useState(answers.areas[area].answer);
  const [note, setNote] = useState(answers.areas[area].note);
  const choices = AREA_ANSWERS.filter((choice) => answers.progress.residence === 'CM' || choice !== 'stanzy');
  return (
    <EditForm
      close={close}
      submit={(current) => ({ ...current, areas: { ...current.areas, [area]: { answer, note: note.trim() } } })}
    >
      {() => (
        <>
          <select
            aria-label={t(`areas.${area}`)}
            autoFocus={true}
            value={answer}
            onChange={(event) => setAnswer(event.target.value as typeof answer)}
            className={field}
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {t(`answers.${choice}`)}
              </option>
            ))}
          </select>
          <textarea
            aria-label={t('note', { area: t(`areas.${area}`) })}
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border-2 border-fog-light bg-white px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
          />
        </>
      )}
    </EditForm>
  );
}
