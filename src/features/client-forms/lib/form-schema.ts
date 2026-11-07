import { z } from 'zod';

import { gapsIn, isMonth, requiredWindow } from '@/features/client-forms/lib/periods';

/** The Documents of « Renseignements du client » that are filled in as forms here, by their Checklist kind. */
export const FORM_KINDS = ['personalHistory', 'familyInformation'] as const;
export type FormKind = (typeof FORM_KINDS)[number];
export const isFormKind = (kind: string | null): kind is FormKind => (FORM_KINDS as readonly string[]).includes(kind ?? '');

const TEXT_MAX = 200;
const text = z.string().trim().max(TEXT_MAX);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().refine(isMonth, 'MONTH');
const id = z.string().min(1).max(40);

// ─── Historique personnel et adresses (Annexe A) ──────────────────────────

export const ACTIVITY_KINDS = ['study', 'work', 'selfEmployed', 'unemployed', 'jobSearch', 'homemaker', 'travel', 'retired', 'other'] as const;

const activity = z.object({
  id,
  from: month,
  /** null: still going on (« à ce jour »). */
  to: month.nullable(),
  kind: z.enum(ACTIVITY_KINDS),
  /** The school, the employer and the job, the trip's purpose… */
  title: text,
  city: text,
  country: text,
  /** Status in that country (citizen, student, worker, visitor…). */
  status: text,
});

const address = z.object({
  id,
  from: month,
  to: month.nullable(),
  line: text,
  city: text,
  province: text,
  postalCode: z.string().trim().max(20),
  country: text,
});

export const personalHistorySchema = z.object({
  birthDate: day.nullable(),
  activities: z.array(activity).max(100),
  addresses: z.array(address).max(100),
});
export type PersonalHistory = z.infer<typeof personalHistorySchema>;
export type Activity = PersonalHistory['activities'][number];
export type Address = PersonalHistory['addresses'][number];

export const EMPTY_HISTORY: PersonalHistory = { birthDate: null, activities: [], addresses: [] };

// ─── Renseignements sur la famille (IMM 5406) ─────────────────────────────

export const RELATIONS = ['applicant', 'spouse', 'child', 'mother', 'father', 'sibling'] as const;
export const MARITAL = ['single', 'married', 'commonLaw', 'divorced', 'separated', 'widowed', 'annulled'] as const;

const member = z.object({
  id,
  relation: z.enum(RELATIONS),
  name: text,
  birthDate: day.nullable(),
  birthCountry: text,
  maritalStatus: z.enum(MARITAL).nullable(),
  /** Current address; for someone who died, the date and place instead. */
  address: text,
  occupation: text,
  deceased: z.boolean(),
  deathDate: day.nullable(),
  deathPlace: text,
  /** Comes to Canada with the applicant. */
  accompanying: z.boolean(),
});

export const familySchema = z.object({ members: z.array(member).max(40) });
export type Family = z.infer<typeof familySchema>;
export type Member = Family['members'][number];

export const EMPTY_FAMILY: Family = { members: [] };

// ─── What is still missing ────────────────────────────────────────────────

export type HistoryCheck = {
  window: { from: string; to: string };
  activityGaps: { from: string; to: string }[];
  addressGaps: { from: string; to: string }[];
  complete: boolean;
};

/** What IRCC would find missing in the history: the uncovered months, of activities and of addresses. */
export function checkHistory(history: PersonalHistory, today: Date): HistoryCheck {
  const window = requiredWindow(today, history.birthDate);
  const activityGaps = gapsIn(history.activities, window);
  const addressGaps = gapsIn(history.addresses, window);
  return {
    window,
    activityGaps,
    addressGaps,
    complete: history.birthDate !== null && activityGaps.length === 0 && addressGaps.length === 0,
  };
}

/** The family is complete once the applicant and both parents are there, each with a name and a birth date. */
export function familyMissing(family: Family): ('applicant' | 'mother' | 'father' | 'details')[] {
  const missing: ('applicant' | 'mother' | 'father' | 'details')[] = [];
  for (const relation of ['applicant', 'mother', 'father'] as const) {
    if (!family.members.some((person) => person.relation === relation)) missing.push(relation);
  }
  if (family.members.some((person) => !person.name || !person.birthDate)) missing.push('details');
  return missing;
}

export const saveFormInput = z.discriminatedUnion('kind', [
  z.object({ documentId: id, kind: z.literal('personalHistory'), data: personalHistorySchema }),
  z.object({ documentId: id, kind: z.literal('familyInformation'), data: familySchema }),
]);
export const documentRef = z.object({ documentId: id });
