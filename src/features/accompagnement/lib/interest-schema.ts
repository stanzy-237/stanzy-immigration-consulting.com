import { z } from 'zod';

import type { DocumentId } from '@/features/checklist/lib/build-checklist';
import { checklistFormSchema, MAX_ENTRIES, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import type { CrsProfile } from '@/features/crs/lib/compute-crs';
import { crsProfileSchema } from '@/features/crs/lib/profile-schema';
import type { StageKey } from '@/features/dossiers/data/workflows';

export const NOTE_MAX = 500;
export const REASON_MAX = 500;
export const COUNTRY_MAX = 80;

/** The document areas a Demande asks about, each with an answer and a note. */
export const AREAS = ['identity', 'studies', 'language', 'work', 'funds', 'police', 'family'] as const;
export type Area = (typeof AREAS)[number];

/** « Je l'ai / Je ne l'ai pas / Pas sûr / Stanzy s'en charge » (the last in Cameroon only). */
export const AREA_ANSWERS = ['have', 'missing', 'unsure', 'stanzy'] as const;
export type AreaAnswer = (typeof AREA_ANSWERS)[number];

export const LANGUAGE_TESTS = ['none', 'tcf', 'tef', 'ielts', 'celpip', 'pte'] as const;
export const RESIDENCES = ['CM', 'CA', 'OTHER'] as const;
export const LEVELS = ['A', 'B', 'C'] as const;
export type Level = (typeof LEVELS)[number];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Where the candidate stands today: what sets the Niveau. */
export const progressSchema = z.object({
  age: z.number().int().min(16).max(80),
  citizenship: z.string().trim().min(2).max(COUNTRY_MAX),
  residence: z.enum(RESIDENCES),
  /** The country, when it is neither Cameroon nor Canada. */
  residenceOther: z.string().trim().max(COUNTRY_MAX),
  languageTest: z.enum(LANGUAGE_TESTS),
  /** An EDE (WES, IQAS…) done for foreign studies. */
  ede: z.boolean(),
  eeProfile: z.boolean(),
  ita: z.boolean(),
  /** `YYYY-MM-DD`, when an ITA was received. */
  itaDate: z.string().regex(DAY).nullable(),
});
export type Progress = z.infer<typeof progressSchema>;

export const COMPANY_MAX = 120;
export const PHONE_MAX = 30;
/** A Canadian CNP (NOC 2021) code: five digits. */
export const CNP_PATTERN = /^\d{5}$/;

/** One job, as IRCC asks it: where, which CNP, from when to when (`endOn` null: still there). */
export const experienceSchema = z
  .object({
    title: z.string().trim().min(2).max(COMPANY_MAX),
    company: z.string().trim().min(2).max(COMPANY_MAX),
    cnp: z.string().trim().regex(CNP_PATTERN),
    startOn: z.string().regex(DAY),
    endOn: z.string().regex(DAY).nullable(),
  })
  .refine((job) => job.endOn === null || job.endOn >= job.startOn, { message: 'INTEREST_JOB_DATES', path: ['endOn'] });
export type Experience = z.infer<typeof experienceSchema>;

/** How to reach them, and each job in detail (#147). */
export const workSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX)
    .regex(/^\+?[\d\s().-]{6,}$/),
  experiences: z.array(experienceSchema).max(MAX_ENTRIES),
});
export type Work = z.infer<typeof workSchema>;

const areaSchema = z.object({ answer: z.enum(AREA_ANSWERS), note: z.string().trim().max(NOTE_MAX) });
export const areasSchema = z.object(Object.fromEntries(AREAS.map((area) => [area, areaSchema])) as Record<Area, typeof areaSchema>);
export type Areas = z.infer<typeof areasSchema>;

/** The Demande d'intérêt as sent: with their CRS answers, scored on the server. « Stanzy s'en charge » only from Cameroon. */
export const interestAnswersSchema = z
  .object({
    checklist: checklistFormSchema,
    progress: progressSchema,
    work: workSchema,
    areas: areasSchema,
    crs: crsProfileSchema,
  })
  .refine(
    (answers) => answers.progress.residence === 'CM' || AREAS.every((area) => answers.areas[area].answer !== 'stanzy'),
    { message: 'INTEREST_STANZY_CAMEROON_ONLY', path: ['areas'] },
  )
  .refine((answers) => !answers.progress.ita || answers.progress.eeProfile, {
    message: 'INTEREST_ITA_WITHOUT_PROFILE',
    path: ['progress', 'ita'],
  });
/** The Demande as the form sends it. */
export type InterestInput = z.infer<typeof interestAnswersSchema>;

/** Their CRS answers and the score the rules in force gave them when sent. */
export type SavedCrs = { profile: CrsProfile; rules: string; total: number };
/** As saved; a Demande sent before the CRS step (#81) has no `crs`, one before #147 no `work`. */
export type InterestAnswers = { checklist: ChecklistForm; progress: Progress; work?: Work; areas: Areas; crs?: SavedCrs };

/** The consultant sets or clears the ITA date of an Accompagnement Dossier. */
export const itaDateInput = z.object({ dossierId: z.string().min(1), itaDate: z.string().regex(DAY).nullable() });

export const decideInput = z.object({ id: z.string().min(1), level: z.enum(LEVELS) });
export const rejectInput = z.object({ id: z.string().min(1), reason: z.string().trim().max(REASON_MAX) });
export const INTEREST_FILTERS = ['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'] as const;
export const interestListInput = z.object({ filter: z.enum(INTEREST_FILTERS) });

/**
 * The Niveau (GLOSSARY): C once in the Entrée Express pool (invited or not);
 * B with a language test and the EDE done (or studies in Canada only, which
 * need none); A otherwise.
 */
export function levelOf(answers: Pick<InterestAnswers, 'checklist' | 'progress'>): Level {
  const { progress, checklist } = answers;
  if (progress.eeProfile || progress.ita) return 'C';
  const languageDone = progress.languageTest !== 'none';
  const studiesDone = progress.ede || (checklist.canadianEducation && !checklist.foreignEducation);
  return languageDone && studiesDone ? 'B' : 'A';
}

/** Where the Accompagnement Dossier opens: A at the start, B at the profile, C in the pool, or at the ITA. */
export function startStageOf(level: Level, ita: boolean): StageKey<'ACCOMPAGNEMENT'> {
  if (level === 'A') return 'evaluation';
  if (level === 'B') return 'profil-ee';
  return ita ? 'ita' : 'bassin';
}

/** Which area a Checklist document belongs to; null for those no area covers (medical exam, forms…). */
export const AREA_OF: Partial<Record<DocumentId, Area>> = {
  passport: 'identity',
  photo: 'identity',
  birthCertificate: 'identity',
  personalHistory: 'identity',
  eca: 'studies',
  diplomas: 'studies',
  transcripts: 'studies',
  canadianDiploma: 'studies',
  languageResults: 'language',
  secondLanguageResults: 'language',
  referenceLetters: 'work',
  selfEmployedProof: 'work',
  workPermit: 'work',
  payslips: 'work',
  employmentContract: 'work',
  socialSecurity: 'work',
  salaryStatements: 'work',
  canadianTaxRecords: 'work',
  resume: 'work',
  jobOfferLetter: 'work',
  bankLetter: 'funds',
  fundsExemptionLetter: 'funds',
  bankStatements: 'funds',
  policeCertificate: 'police',
  marriageCertificate: 'family',
  commonLawProof: 'family',
  previousUnionProof: 'family',
  familyInformation: 'family',
  siblingProof: 'family',
};

/** Where a missing document can be got: language results at the TCF academy, diplomas through an EDE. */
export function helpFor(kind: string | null): 'tcf' | 'ede' | null {
  if (kind === 'languageResults' || kind === 'secondLanguageResults') return 'tcf';
  if (kind === 'eca' || kind === 'diplomas' || kind === 'transcripts') return 'ede';
  return null;
}

const FROM_CRS_TEST: Record<string, Progress['languageTest']> = {
  TCF: 'tcf',
  TEF: 'tef',
  IELTS: 'ielts',
  CELPIP: 'celpip',
  PTE_CORE: 'pte',
};

/** What a saved CRS Simulation already says of where they stand: their age and language test. */
export function progressFromCrs(crs: { age: string; firstLanguage: { test: string } }): Partial<Progress> {
  const age = Number(crs.age);
  return {
    ...(Number.isInteger(age) && age >= 16 && age <= 80 ? { age } : {}),
    languageTest: FROM_CRS_TEST[crs.firstLanguage.test] ?? 'none',
  };
}

/** A Demande's first « where you stand » answers. */
export const DEFAULT_PROGRESS: Progress = {
  age: 30,
  citizenship: '',
  residence: 'CM',
  residenceOther: '',
  languageTest: 'none',
  ede: false,
  eeProfile: false,
  ita: false,
  itaDate: null,
};

/** The work step's first answers: one row per job the Checklist step named. */
export const workFor = (jobs: { title: string }[], current?: Work): Work => ({
  phone: current?.phone ?? '',
  experiences: jobs.map(
    (job) =>
      current?.experiences.find((experience) => experience.title === job.title) ?? {
        title: job.title,
        company: '',
        cnp: '',
        startOn: '',
        endOn: null,
      },
  ),
});

export const DEFAULT_AREAS = Object.fromEntries(AREAS.map((area) => [area, { answer: 'have', note: '' }])) as Areas;
