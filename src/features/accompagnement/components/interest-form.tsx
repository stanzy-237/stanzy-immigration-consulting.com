'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, Gauge, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import {
  AREA_ANSWERS,
  AREAS,
  COUNTRY_MAX,
  DEFAULT_AREAS,
  DEFAULT_PROGRESS,
  LANGUAGE_TESTS,
  NOTE_MAX,
  progressFromCrs,
  progressSchema,
  RESIDENCES,
  COMPANY_MAX,
  CNP_PATTERN,
  PHONE_MAX,
  workFor,
  workSchema,
  type Areas,
  type Experience,
  type Progress,
  type Work,
} from '@/features/accompagnement/lib/interest-schema';
import { choosePrefill, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { computeCrs } from '@/features/crs/lib/compute-crs';
import { DEFAULT_FORM, fromProfile, toProfile, type CrsForm } from '@/features/crs/lib/crs-form';
import { ChecklistFields } from '@/features/shared/components/checklist-fields';
import { CrsFields } from '@/features/shared/components/crs-fields';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { rulesInForceOn } from '@/features/shared/lib/rules-version';
import { useTRPC } from '@/trpc/client';

const field =
  'h-12 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-body text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const card = 'rounded-2xl border border-fog-light bg-white p-5 shadow-sm sm:p-6';
const primary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rouge px-7 font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-50';
const secondary =
  'inline-flex h-12 items-center gap-2 rounded-full px-5 font-heading text-body font-bold text-navy-deep hover:bg-off-white';

type Step = 'situation' | 'progress' | 'work' | 'crs' | 'documents';
const STEPS: Step[] = ['situation', 'progress', 'work', 'crs', 'documents'];

/** The official CNP (NOC 2021) search, to find a job's code. */
const CNP_SEARCH_URL = 'https://noc.esdc.gc.ca/';

/**
 * The Demande d'intérêt (#81), in five steps: the Checklist's questions
 * (prefilled from the Account's Checklist, else its latest CRS Simulation),
 * where they stand (test, EDE, profile, ITA), their phone and each job's
 * company, CNP code and dates (#147), their CRS answers with the
 * score as they go (prefilled from that Simulation), then each document area
 * with a note. « Stanzy s'en charge » shows for Cameroon only. Once sent,
 * the page gives their CRS score.
 */
export function InterestForm({ onSent }: { onSent: () => void }): ReactNode {
  const trpc = useTRPC();
  const [checklist, simulations] = useSuspenseQueries({
    queries: [trpc.checklist.get.queryOptions(), trpc.crs.list.queryOptions()],
  });
  const latest = checklist.data?.answers ? null : (simulations.data[0] ?? null);
  // The latest CRS Simulation's answers, when there's no saved Checklist to start from.
  const { data: simulation, isPending } = useQuery({
    ...trpc.crs.get.queryOptions({ id: latest?.id ?? '' }),
    enabled: Boolean(latest),
  });
  if (latest && isPending) return null;
  const crs = simulation ? fromProfile(simulation.profile) : null;
  const prefill = choosePrefill({
    own: checklist.data?.answers ?? null,
    saved: crs && latest ? { name: latest.name, answers: crs } : null,
    draft: null,
  });
  return (
    <Steps
      prefill={prefill}
      progress={{ ...DEFAULT_PROGRESS, ...(crs ? progressFromCrs(crs) : {}) }}
      crs={crs}
      onSent={onSent}
    />
  );
}

function Steps({
  prefill,
  progress: initialProgress,
  crs: savedCrs,
  onSent,
}: {
  prefill: ReturnType<typeof choosePrefill>;
  progress: Progress;
  /** Their latest CRS Simulation's answers, if any. */
  crs: CrsForm | null;
  onSent: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('situation');
  const [situation, setSituation] = useState<ChecklistForm>(prefill.answers);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [work, setWork] = useState<Work>(() => workFor(prefill.answers.jobs));
  const [areas, setAreas] = useState<Areas>(DEFAULT_AREAS);
  const [crsForm, setCrsForm] = useState<CrsForm | null>(savedCrs);
  // `interest.viewed`, then `interest.started` once past the first step; the send is counted on the server.
  const markStarted = useCalculatorTracking('interest');
  const errors = useTranslations('Accompagnement.errors');
  const toasts = useTranslations('Accompagnement.toast');
  const submit = useMutation(
    trpc.accompagnement.submit.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.mine.queryKey() });
        toast.add({ title: toasts('sent'), type: 'success' });
        onSent();
      },
      onError: (error) => {
        const known = errors.has(error.message);
        toast.add({ title: errors(known ? error.message : 'UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  const index = STEPS.indexOf(step);

  return (
    <div className="grid grid-cols-1 gap-5">
      <p className="text-sm font-semibold text-slate">{t('stepOf', { step: index + 1, name: t(`steps.${step}`) })}</p>
      {step === 'situation' ? (
        <ChecklistFields
          answers={situation}
          source={prefill.source}
          submitLabel={t('next')}
          onContinue={(answers) => {
            markStarted();
            setSituation(answers);
            setStep('progress');
          }}
        />
      ) : step === 'progress' ? (
        <ProgressStep
          value={progress}
          onBack={() => setStep('situation')}
          onNext={(next) => {
            setProgress(next);
            // Moving away from Cameroon takes « Stanzy s'en charge » back.
            if (next.residence !== 'CM') {
              setAreas((current) =>
                Object.fromEntries(
                  AREAS.map((area) => [
                    area,
                    current[area].answer === 'stanzy' ? { ...current[area], answer: 'missing' } : current[area],
                  ]),
                ) as Areas,
              );
            }
            // Without a Simulation, the CRS step starts from the age they just gave.
            setCrsForm((current) => current ?? { ...DEFAULT_FORM, age: String(next.age) });
            // One row per job named at the first step, keeping what they already wrote.
            setWork((current) => workFor(situation.jobs, current));
            setStep('work');
          }}
        />
      ) : step === 'work' ? (
        <WorkStep
          value={work}
          onBack={() => setStep('progress')}
          onNext={(next) => {
            setWork(next);
            setStep('crs');
          }}
        />
      ) : step === 'crs' && crsForm ? (
        <CrsStep
          value={crsForm}
          onChange={setCrsForm}
          onBack={() => setStep('work')}
          onNext={() => setStep('documents')}
        />
      ) : (
        <DocumentsStep
          value={areas}
          cameroon={progress.residence === 'CM'}
          pending={submit.isPending}
          onChange={setAreas}
          onBack={() => setStep('crs')}
          onSubmit={() =>
            submit.mutate({ checklist: situation, progress, work, areas, crs: toProfile(crsForm ?? DEFAULT_FORM) })
          }
        />
      )}
    </div>
  );
}

function ProgressStep({
  value,
  onBack,
  onNext,
}: {
  value: Progress;
  onBack: () => void;
  onNext: (progress: Progress) => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const ids = useId();
  const [form, setForm] = useState(value);
  const [age, setAge] = useState(String(value.age));
  const [invalid, setInvalid] = useState(false);
  const update = (patch: Partial<Progress>) => setForm((current) => ({ ...current, ...patch }));

  const next = (event: FormEvent) => {
    event.preventDefault();
    const candidate = {
      ...form,
      age: Number(age),
      residenceOther: form.residence === 'OTHER' ? form.residenceOther : '',
      ita: form.eeProfile && form.ita,
      itaDate: form.eeProfile && form.ita ? form.itaDate : null,
    };
    const parsed = progressSchema.safeParse(candidate);
    const otherMissing = candidate.residence === 'OTHER' && candidate.residenceOther.trim().length < 2;
    setInvalid(!parsed.success || otherMissing);
    if (parsed.success && !otherMissing) onNext(parsed.data);
  };
  const check = (id: string, label: string, checked: boolean, onChange: (value: boolean) => void) => (
    <label htmlFor={`${ids}-${id}`} className="flex items-start gap-3 text-body text-navy-deep">
      <input
        id={`${ids}-${id}`}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 accent-rouge"
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={next} noValidate className={`grid gap-4 ${card}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label htmlFor={`${ids}-age`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('age')}
          <input
            id={`${ids}-age`}
            inputMode="numeric"
            value={age}
            aria-invalid={invalid && !Number.isInteger(Number(age))}
            onChange={(event) => setAge(event.target.value)}
            className={field}
          />
        </label>
        <label htmlFor={`${ids}-citizenship`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('citizenship')}
          <input
            id={`${ids}-citizenship`}
            maxLength={COUNTRY_MAX}
            value={form.citizenship}
            aria-invalid={invalid && form.citizenship.trim().length < 2}
            onChange={(event) => update({ citizenship: event.target.value })}
            className={field}
          />
        </label>
        <label htmlFor={`${ids}-residence`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('residence')}
          <select
            id={`${ids}-residence`}
            value={form.residence}
            onChange={(event) => update({ residence: event.target.value as Progress['residence'] })}
            className={field}
          >
            {RESIDENCES.map((residence) => (
              <option key={residence} value={residence}>
                {t(`residences.${residence}`)}
              </option>
            ))}
          </select>
        </label>
        {form.residence === 'OTHER' ? (
          <label htmlFor={`${ids}-other`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t('residenceOther')}
            <input
              id={`${ids}-other`}
              maxLength={COUNTRY_MAX}
              value={form.residenceOther}
              aria-invalid={invalid && form.residenceOther.trim().length < 2}
              onChange={(event) => update({ residenceOther: event.target.value })}
              className={field}
            />
          </label>
        ) : null}
        <label htmlFor={`${ids}-test`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
          {t('languageTest')}
          <select
            id={`${ids}-test`}
            value={form.languageTest}
            onChange={(event) => update({ languageTest: event.target.value as Progress['languageTest'] })}
            className={field}
          >
            {LANGUAGE_TESTS.map((test) => (
              <option key={test} value={test}>
                {t(`languageTests.${test}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {check('ede', t('ede'), form.ede, (ede) => update({ ede }))}
        {check('profile', t('eeProfile'), form.eeProfile, (eeProfile) => update({ eeProfile, ita: eeProfile && form.ita }))}
        {form.eeProfile ? check('ita', t('ita'), form.ita, (ita) => update({ ita })) : null}
        {form.eeProfile && form.ita ? (
          <label htmlFor={`${ids}-ita-date`} className="grid grid-cols-1 max-w-xs gap-1 text-sm font-semibold text-navy-deep">
            {t('itaDate')}
            <input
              id={`${ids}-ita-date`}
              type="date"
              value={form.itaDate ?? ''}
              onChange={(event) => update({ itaDate: event.target.value || null })}
              className={field}
            />
          </label>
        ) : null}
      </div>
      {invalid ? (
        <p role="alert" className="text-sm font-medium text-rouge">
          {t('invalid')}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </button>
        <button type="submit" className={primary}>
          {t('next')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
      </div>
    </form>
  );
}

/** Their phone, then each job named at the first step: company, CNP code, dates (#147). */
function WorkStep({
  value,
  onBack,
  onNext,
}: {
  value: Work;
  onBack: () => void;
  onNext: (work: Work) => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const ids = useId();
  const [form, setForm] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const setJob = (index: number, patch: Partial<Experience>) =>
    setForm((current) => ({
      ...current,
      experiences: current.experiences.map((job, at) => (at === index ? { ...job, ...patch } : job)),
    }));

  const next = (event: FormEvent) => {
    event.preventDefault();
    const parsed = workSchema.safeParse(form);
    setInvalid(!parsed.success);
    if (parsed.success) onNext(parsed.data);
  };
  // Flagged once they tried to go on.
  const bad = (wrong: boolean) => invalid && wrong;
  const badDate = (day: string | null) => !day || !/^\d{4}-\d{2}-\d{2}$/.test(day);

  return (
    <form onSubmit={next} noValidate className={`grid gap-4 ${card}`}>
      <p className="text-body text-slate">{t('work.intro')}</p>
      <label htmlFor={`${ids}-phone`} className="grid grid-cols-1 max-w-sm gap-1 text-sm font-semibold text-navy-deep">
        {t('work.phone')}
        <input
          id={`${ids}-phone`}
          type="tel"
          autoComplete="tel"
          maxLength={PHONE_MAX}
          value={form.phone}
          aria-invalid={bad(!workSchema.shape.phone.safeParse(form.phone).success)}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          className={field}
        />
      </label>
      <p className="text-sm text-slate">
        {t('work.cnpHint')}{' '}
        <a
          href={CNP_SEARCH_URL}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 font-semibold text-rouge hover:text-crimson"
        >
          {t('work.cnpLink')}
          <ExternalLink aria-hidden={true} className="size-3.5" />
        </a>
      </p>
      {form.experiences.length === 0 ? <p className="text-sm text-slate">{t('work.noJobs')}</p> : null}
      {form.experiences.map((job, index) => {
        const id = `${ids}-job-${index}`;
        return (
          <fieldset key={job.title + index} className="grid grid-cols-1 gap-3 rounded-xl bg-off-white p-4 sm:grid-cols-2">
            <legend className="mb-1 font-heading text-body font-bold text-navy-deep sm:col-span-2">
              {job.title}
            </legend>
            <label htmlFor={`${id}-company`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep sm:col-span-2">
              {t('work.company')}
              <input
                id={`${id}-company`}
                maxLength={COMPANY_MAX}
                value={job.company}
                aria-invalid={bad(job.company.trim().length < 2)}
                onChange={(event) => setJob(index, { company: event.target.value })}
                className={field}
              />
            </label>
            <label htmlFor={`${id}-cnp`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
              {t('work.cnp')}
              <input
                id={`${id}-cnp`}
                inputMode="numeric"
                maxLength={5}
                value={job.cnp}
                aria-invalid={bad(!CNP_PATTERN.test(job.cnp.trim()))}
                onChange={(event) => setJob(index, { cnp: event.target.value })}
                className={field}
              />
            </label>
            <span aria-hidden={true} className="hidden sm:block" />
            <label htmlFor={`${id}-start`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
              {t('work.startOn')}
              <input
                id={`${id}-start`}
                type="date"
                value={job.startOn}
                aria-invalid={bad(badDate(job.startOn))}
                onChange={(event) => setJob(index, { startOn: event.target.value })}
                className={field}
              />
            </label>
            <div className="grid grid-cols-1 gap-2">
              {job.endOn !== null ? (
                <label htmlFor={`${id}-end`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
                  {t('work.endOn')}
                  <input
                    id={`${id}-end`}
                    type="date"
                    value={job.endOn}
                    min={job.startOn || undefined}
                    aria-invalid={bad(badDate(job.endOn) || job.endOn < job.startOn)}
                    onChange={(event) => setJob(index, { endOn: event.target.value })}
                    className={field}
                  />
                </label>
              ) : null}
              <label htmlFor={`${id}-current`} className="flex items-center gap-3 text-sm text-navy-deep">
                <input
                  id={`${id}-current`}
                  type="checkbox"
                  checked={job.endOn === null}
                  onChange={(event) => setJob(index, { endOn: event.target.checked ? null : '' })}
                  className="size-5 accent-rouge"
                />
                {t('work.current')}
              </label>
            </div>
          </fieldset>
        );
      })}
      {invalid ? (
        <p role="alert" className="text-sm font-medium text-rouge">
          {t('work.invalid')}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </button>
        <button type="submit" className={primary}>
          {t('next')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
      </div>
    </form>
  );
}

/** Their CRS answers, the score updating as they go: the calculator's own questions. */
function CrsStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: CrsForm;
  onChange: (form: CrsForm) => void;
  onBack: () => void;
  onNext: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const rules = rulesInForceOn(new Date());
  const result = useMemo(() => computeCrs(toProfile(value), { rules }), [value, rules]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (result.ok) onNext();
      }}
      noValidate
      className="grid grid-cols-1 gap-4"
    >
      <p className="text-body text-slate">{t('crsIntro')}</p>
      <div
        role="status"
        aria-live="polite"
        className="sticky top-20 z-10 flex items-center justify-between gap-3 rounded-2xl bg-navy-deep px-5 py-4 text-white shadow-md"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Gauge aria-hidden={true} className="size-5 text-rose" />
          {t('crsLive')}
        </span>
        <span className="font-heading text-3xl font-bold tabular-nums">{result.ok ? result.breakdown.total : '—'}</span>
      </div>
      <CrsFields form={value} onChange={onChange} rules={rules} result={result} />
      {result.ok ? null : (
        <p role="alert" className="text-sm font-medium text-rouge">
          {t('invalid')}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </button>
        <button type="submit" disabled={!result.ok} className={primary}>
          {t('next')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
      </div>
    </form>
  );
}

function DocumentsStep({
  value,
  cameroon,
  pending,
  onChange,
  onBack,
  onSubmit,
}: {
  value: Areas;
  cameroon: boolean;
  pending: boolean;
  onChange: (areas: Areas) => void;
  onBack: () => void;
  onSubmit: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.form');
  const ids = useId();
  const answers = AREA_ANSWERS.filter((answer) => cameroon || answer !== 'stanzy');
  const set = (area: (typeof AREAS)[number], patch: Partial<Areas[typeof area]>) =>
    onChange({ ...value, [area]: { ...value[area], ...patch } });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="grid grid-cols-1 gap-4"
    >
      <p className="text-body text-slate">{t('documentsIntro')}</p>
      {cameroon ? <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('stanzyHint')}</p> : null}
      {AREAS.map((area) => (
        <fieldset key={area} className={card}>
          <legend className="sr-only">{t(`areas.${area}`)}</legend>
          <p aria-hidden={true} className="mb-3 font-heading text-body font-bold text-navy-deep">
            {t(`areas.${area}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {answers.map((answer) => (
              <label
                key={answer}
                htmlFor={`${ids}-${area}-${answer}`}
                className={
                  value[area].answer === answer
                    ? 'inline-flex h-10 cursor-pointer items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white has-focus-visible:ring-2 has-focus-visible:ring-rouge'
                    : 'inline-flex h-10 cursor-pointer items-center rounded-full border border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep has-focus-visible:ring-2 has-focus-visible:ring-rouge'
                }
              >
                <input
                  id={`${ids}-${area}-${answer}`}
                  type="radio"
                  name={`${ids}-${area}`}
                  value={answer}
                  checked={value[area].answer === answer}
                  onChange={() => set(area, { answer })}
                  className="sr-only"
                />
                {t(`answers.${answer}`)}
              </label>
            ))}
          </div>
          <label htmlFor={`${ids}-${area}-note`} className="mt-3 grid grid-cols-1 gap-1 text-xs font-semibold text-slate">
            {t('note', { area: t(`areas.${area}`) })}
            <textarea
              id={`${ids}-${area}-note`}
              rows={2}
              maxLength={NOTE_MAX}
              value={value[area].note}
              placeholder={t('notePlaceholder')}
              onChange={(event) => set(area, { note: event.target.value })}
              className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
            />
          </label>
        </fieldset>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </button>
        <button type="submit" disabled={pending} className={primary}>
          <Send aria-hidden={true} className="size-4" />
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
