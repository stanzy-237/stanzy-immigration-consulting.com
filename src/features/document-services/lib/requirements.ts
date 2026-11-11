import { z } from 'zod';

import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import type { Prerequisite, Questionnaire } from '@/features/document-services/lib/service-schema';

/** Up to three people to reach in an emergency, for the bank. */
export const CONTACTS_MAX = 3;

const text = (max: number) => z.string().trim().max(max);
const person = z.object({ name: text(120), phone: text(30) });

/** Up to five salary accounts, one per employer. */
export const SALARY_ACCOUNTS_MAX = 5;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** An account their salary is paid into: the employer and the period (`endOn` null: still paid there). */
const salaryAccount = z.object({
  company: text(120),
  startOn: z.string().max(10),
  endOn: z.string().max(10).nullable(),
});
export type SalaryAccount = z.infer<typeof salaryAccount>;

/**
 * The proof of funds questionnaire, as the Client fills it in (saved at any
 * point: `questionsLeft` says what is still to answer). `ubaAccount` is asked
 * of the « sans fonds » service only: a new account is opened for the Client.
 * `salaryAccount` (#147): whether a salary is paid into an account, then each
 * one's employer and period; answers saved before it read as unanswered.
 */
export const answersSchema = z.object({
  niu: text(30),
  contacts: z.array(person).max(CONTACTS_MAX),
  donation: z.boolean().nullable(),
  donor: person.extend({ email: text(200) }).nullable(),
  ubaAccount: z.boolean().nullable(),
  salaryAccount: z.boolean().nullable().default(null),
  salaryAccounts: z.array(salaryAccount).max(SALARY_ACCOUNTS_MAX).default([]),
});
export type Answers = z.output<typeof answersSchema>;

export const EMPTY_ANSWERS: Answers = {
  niu: '',
  contacts: [],
  donation: null,
  donor: null,
  ubaAccount: null,
  salaryAccount: null,
  salaryAccounts: [],
};

/** Stored answers, whatever was saved before. */
export function answersOf(value: unknown): Answers {
  const parsed = answersSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_ANSWERS;
}

export type Question = 'niu' | 'contacts' | 'donation' | 'donor' | 'ubaAccount' | 'salaryAccount' | 'salaryAccounts';

const filled = (value: string, min = 2) => value.trim().length >= min;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A salary account with its employer named and its period in order. */
const datedAccount = (account: SalaryAccount): boolean =>
  filled(account.company) &&
  DAY.test(account.startOn) &&
  (account.endOn === null || (DAY.test(account.endOn) && account.endOn >= account.startOn));

/** The questions of `questionnaire` still unanswered, in the order the form asks them; none without one. */
export function questionsLeft(questionnaire: Questionnaire | null, answers: Answers): Question[] {
  if (!questionnaire) return [];
  const left: Question[] = [];
  if (!filled(answers.niu, 5)) left.push('niu');
  if (answers.contacts.length === 0 || answers.contacts.some((contact) => !filled(contact.name) || !filled(contact.phone, 6))) {
    left.push('contacts');
  }
  if (answers.donation === null) left.push('donation');
  if (
    answers.donation &&
    (!answers.donor || !filled(answers.donor.name) || !filled(answers.donor.phone, 6) || !EMAIL.test(answers.donor.email))
  ) {
    left.push('donor');
  }
  if (questionnaire === 'proofOfFundsNoFunds' && answers.ubaAccount === null) left.push('ubaAccount');
  if (answers.salaryAccount === null) left.push('salaryAccount');
  if (answers.salaryAccount && (answers.salaryAccounts.length === 0 || !answers.salaryAccounts.every(datedAccount))) {
    left.push('salaryAccounts');
  }
  return left;
}

/** The prerequisites asked with these answers: the donor's ones only for a donation. */
export const askedPrerequisites = (prerequisites: Prerequisite[], answers: Answers): Prerequisite[] =>
  prerequisites.filter((item) => item.when !== 'donation' || answers.donation === true);

/** Where the files handed over for a request sit in the private R2 bucket (ADR 0007). */
export const requirementFilePrefix = (requestId: string): string => `requirements/${requestId}/`;

const id = z.string().min(1);

export const requestRef = z.object({ requestId: id });
export const saveAnswersInput = requestRef.extend({ answers: answersSchema });
/** `prerequisite`: the key of the service's prerequisite it is for (`key` is the file's own encryption key). */
export const addRequirementFileInput = encryptedFileInput.extend({ requestId: id, prerequisite: z.string().min(1).max(40) });

/** Where a requirement file opens, decrypted by the server. */
export const requirementFileUrl = (fileId: string): string => `/api/requirements/files/${fileId}`;

const DAY_IN_MS = 86_400_000;
const utcDay = (day: string): number => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
};

/** The consultant sets the day the work starts (proof of funds: the draw from the pool); null takes it off. */
export const setStartInput = requestRef.extend({ startedOn: z.string().regex(DAY).nullable() });

/** The day a request is due (`YYYY-MM-DD`): its start plus the service's turnaround; null without either. */
export function dueOn(startedOn: string | null, turnaroundDays: number | null): string | null {
  if (!startedOn || !turnaroundDays) return null;
  return new Date(utcDay(startedOn) + turnaroundDays * DAY_IN_MS).toISOString().slice(0, 10);
}

/** Whole days from `today` to `day`, both UTC calendar days; negative once past. */
export const daysUntil = (day: string, today: string): number => Math.round((utcDay(day) - utcDay(today)) / DAY_IN_MS);

/**
 * Where the hand-over stands: `OPEN` while the Client gathers the pieces,
 * `SUBMITTED` once they clicked « Suivant » (the documents to receive show,
 * the pieces can still change), `CONFIRMED` once the consultant confirmed
 * them (locked for the Client).
 */
export type HandOver = 'OPEN' | 'SUBMITTED' | 'CONFIRMED';

export const handOverOf = (request: { submittedAt: Date | null; confirmedAt: Date | null }): HandOver =>
  request.confirmedAt ? 'CONFIRMED' : request.submittedAt ? 'SUBMITTED' : 'OPEN';
