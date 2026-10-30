import { z } from 'zod';

import type { CrsForm } from '@/features/crs/lib/crs-form';
import { toLanguageResult } from '@/features/shared/lib/language-form';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

export const MAX_CHILDREN = 10;
export const MAX_POLICE_COUNTRIES = 10;

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
  foreignWork: boolean;
  /** At least a year of skilled work in Canada (Canadian Experience Class). */
  canadianWork: boolean;
  selfEmployed: boolean;
  jobOffer: boolean;
  /** Authorized to work in Canada today (a work permit). */
  authorizedToWork: boolean;
  provincialNomination: boolean;
  certificateOfQualification: boolean;
  siblingInCanada: boolean;
  /** A consultant or lawyer represents the candidate with IRCC. */
  representative: boolean;
  /** Countries (not Canada) lived in 6 months in a row or more, in the last 10 years since age 18. */
  policeCountries: number;
};

export const DEFAULT_CHECKLIST_FORM: ChecklistForm = {
  maritalStatus: 'single',
  spouseAccompanying: false,
  spouseClaimsPoints: false,
  previousUnion: false,
  children: 0,
  foreignEducation: true,
  canadianEducation: false,
  secondLanguage: false,
  foreignWork: true,
  canadianWork: false,
  selfEmployed: false,
  jobOffer: false,
  authorizedToWork: false,
  provincialNomination: false,
  certificateOfQualification: false,
  siblingInCanada: false,
  representative: false,
  policeCountries: 1,
};

export const checklistFormSchema = z.object({
  maritalStatus: z.enum(MARITAL_STATUSES),
  spouseAccompanying: z.boolean(),
  spouseClaimsPoints: z.boolean(),
  previousUnion: z.boolean(),
  children: z.number().int().min(0).max(MAX_CHILDREN),
  foreignEducation: z.boolean(),
  canadianEducation: z.boolean(),
  secondLanguage: z.boolean(),
  foreignWork: z.boolean(),
  canadianWork: z.boolean(),
  selfEmployed: z.boolean(),
  jobOffer: z.boolean(),
  authorizedToWork: z.boolean(),
  provincialNomination: z.boolean(),
  certificateOfQualification: z.boolean(),
  siblingInCanada: z.boolean(),
  representative: z.boolean(),
  policeCountries: z.number().int().min(1).max(MAX_POLICE_COUNTRIES),
}) satisfies z.ZodType<ChecklistForm>;

/** The spouse or partner comes too, so they need their own documents. */
export const spouseComes = (form: ChecklistForm): boolean =>
  isPartnered(form.maritalStatus) && form.spouseAccompanying;

/**
 * The Checklist answers that CRS answers already give. What the CRS doesn't
 * ask (children, self-employment, countries lived in…) is left out, for the
 * form's own answers or defaults to fill.
 */
export function fromCrsForm(crs: CrsForm): Partial<ChecklistForm> {
  const spouseAccompanying =
    isPartnered(crs.maritalStatus) && crs.spouseAccompanying && !crs.spouseIsCanadianCitizenOrPR;
  const hasPostSecondary = crs.education !== 'lessThanSecondary';
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
    foreignWork: crs.foreignWorkYears > 0,
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
