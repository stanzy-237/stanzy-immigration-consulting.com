import { z } from 'zod';

import type { CrsForm } from '@/features/crs/lib/crs-form';
import { toLanguageResult } from '@/features/shared/lib/language-form';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

export const MAX_CHILDREN = 10;
/** Jobs and countries one person can list. */
export const MAX_ENTRIES = 10;

/** A job declared in the profile: IRCC asks for one « Relevé d'emploi » per job, named by its title. */
export type Job = { title: string; inCanada: boolean; selfEmployed: boolean };

/**
 * What the Checklist asks about the candidate: only what changes the list of
 * documents IRCC will ask for after the ITA.
 */
export type ChecklistForm = {
  maritalStatus: MaritalStatus;
  /** The spouse or partner comes to Canada with the candidate (and isn't already Canadian or PR). */
  spouseAccompanying: boolean;
  /** Points are claimed for the spouse's studies or language test. */
  spouseClaimsPoints: boolean;
  /** An earlier marriage or common-law union ended (divorce, death, annulment, separation). */
  previousUnion: boolean;
  /** Dependent children, whether they come or not. */
  children: number;
  foreignEducation: boolean;
  canadianEducation: boolean;
  /** Results in both official languages. */
  secondLanguage: boolean;
  /** The candidate's jobs, at least one. */
  jobs: Job[];
  /** At least a year of skilled work in Canada (Canadian Experience Class). */
  canadianWork: boolean;
  /** Authorized to work in Canada today (a work permit). */
  authorizedToWork: boolean;
  /** Countries (not Canada) lived in 6 months in a row or more, in the last 10 years since age 18: one police certificate each. */
  countries: string[];
  /** The accompanying spouse's job titles. */
  spouseJobs: string[];
  /** The accompanying spouse's countries, as for the candidate. */
  spouseCountries: string[];
  jobOffer: boolean;
  provincialNomination: boolean;
  certificateOfQualification: boolean;
  siblingInCanada: boolean;
  /** A consultant or lawyer represents the candidate with IRCC. */
  representative: boolean;
};

export const emptyJob = (inCanada = false): Job => ({ title: '', inCanada, selfEmployed: false });

/** The form's first answers: one job and one country still to name. */
export const DEFAULT_CHECKLIST_FORM: ChecklistForm = {
  maritalStatus: 'single',
  spouseAccompanying: false,
  spouseClaimsPoints: false,
  previousUnion: false,
  children: 0,
  foreignEducation: true,
  canadianEducation: false,
  secondLanguage: false,
  jobs: [emptyJob()],
  canadianWork: false,
  authorizedToWork: false,
  countries: [''],
  spouseJobs: [],
  spouseCountries: [],
  jobOffer: false,
  provincialNomination: false,
  certificateOfQualification: false,
  siblingInCanada: false,
  representative: false,
};

const name = z.string().trim().min(1).max(80);

/** Complete answers, as saved: every job and country named. */
export const checklistFormSchema = z.object({
  maritalStatus: z.enum(MARITAL_STATUSES),
  spouseAccompanying: z.boolean(),
  spouseClaimsPoints: z.boolean(),
  previousUnion: z.boolean(),
  children: z.number().int().min(0).max(MAX_CHILDREN),
  foreignEducation: z.boolean(),
  canadianEducation: z.boolean(),
  secondLanguage: z.boolean(),
  jobs: z.array(z.object({ title: name, inCanada: z.boolean(), selfEmployed: z.boolean() })).min(1).max(MAX_ENTRIES),
  canadianWork: z.boolean(),
  authorizedToWork: z.boolean(),
  countries: z.array(name).min(1).max(MAX_ENTRIES),
  spouseJobs: z.array(name).max(MAX_ENTRIES),
  spouseCountries: z.array(name).max(MAX_ENTRIES),
  jobOffer: z.boolean(),
  provincialNomination: z.boolean(),
  certificateOfQualification: z.boolean(),
  siblingInCanada: z.boolean(),
  representative: z.boolean(),
}) satisfies z.ZodType<ChecklistForm>;

/** The spouse or partner comes too, so they need their own documents. */
export const spouseComes = (form: ChecklistForm): boolean =>
  isPartnered(form.maritalStatus) && form.spouseAccompanying;

/**
 * The Checklist answers that CRS answers already give. What the CRS doesn't
 * ask (children, job titles, countries…) is left out, or left to name: a
 * job row for each kind of experience the CRS counts.
 */
export function fromCrsForm(crs: CrsForm): Partial<ChecklistForm> {
  const spouseAccompanying =
    isPartnered(crs.maritalStatus) && crs.spouseAccompanying && !crs.spouseIsCanadianCitizenOrPR;
  const hasPostSecondary = crs.education !== 'lessThanSecondary';
  const jobs = [
    ...(crs.foreignWorkYears > 0 ? [emptyJob(false)] : []),
    ...(crs.canadianWorkYears > 0 ? [emptyJob(true)] : []),
  ];
  return {
    maritalStatus: crs.maritalStatus,
    spouseAccompanying,
    spouseClaimsPoints:
      spouseAccompanying &&
      (crs.spouseEducation !== 'lessThanSecondary' || toLanguageResult(crs.spouseLanguage) !== null),
    // The CRS only says whether some studies were in Canada: any others are taken as foreign.
    canadianEducation: crs.canadianStudy !== 'none',
    foreignEducation: hasPostSecondary && crs.canadianStudy === 'none',
    secondLanguage: toLanguageResult(crs.secondLanguage) !== null,
    ...(jobs.length > 0 ? { jobs } : {}),
    canadianWork: crs.canadianWorkYears >= 1,
    jobOffer: crs.highWageJobOffer !== 'none',
    provincialNomination: crs.provincialNomination,
    certificateOfQualification: crs.certificateOfQualification,
    siblingInCanada: crs.siblingInCanada,
  };
}

/** Where the form's first answers came from, said in a note above it. */
export type PrefillSource = { kind: 'own' } | { kind: 'saved'; name: string } | { kind: 'draft' } | { kind: 'none' };

/**
 * The answers the form opens with: the Checklist's own (saved or on this
 * device), else the latest saved CRS Simulation, else the CRS answers in
 * progress on this device, else defaults.
 */
export function choosePrefill({
  own,
  saved,
  draft,
}: {
  own: ChecklistForm | null;
  saved: { name: string; answers: CrsForm } | null;
  draft: CrsForm | null;
}): { answers: ChecklistForm; source: PrefillSource } {
  if (own) return { answers: own, source: { kind: 'own' } };
  if (saved) return { answers: { ...DEFAULT_CHECKLIST_FORM, ...fromCrsForm(saved.answers) }, source: { kind: 'saved', name: saved.name } };
  if (draft) return { answers: { ...DEFAULT_CHECKLIST_FORM, ...fromCrsForm(draft) }, source: { kind: 'draft' } };
  return { answers: DEFAULT_CHECKLIST_FORM, source: { kind: 'none' } };
}
