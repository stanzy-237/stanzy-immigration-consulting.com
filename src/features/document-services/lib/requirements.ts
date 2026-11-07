import { z } from 'zod';

import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import type { Prerequisite, Questionnaire } from '@/features/document-services/lib/service-schema';

/** Up to three people to reach in an emergency, for the bank. */
export const CONTACTS_MAX = 3;

const text = (max: number) => z.string().trim().max(max);
const person = z.object({ name: text(120), phone: text(30) });

/**
 * The proof of funds questionnaire, as the Client fills it in (saved at any
 * point: `questionsLeft` says what is still to answer). `ubaAccount` is asked
 * of the « sans fonds » service only: a new account is opened for the Client.
 */
export const answersSchema = z.object({
  niu: text(30),
  contacts: z.array(person).max(CONTACTS_MAX),
  donation: z.boolean().nullable(),
  donor: person.extend({ email: text(200) }).nullable(),
  ubaAccount: z.boolean().nullable(),
});
export type Answers = z.infer<typeof answersSchema>;

export const EMPTY_ANSWERS: Answers = { niu: '', contacts: [], donation: null, donor: null, ubaAccount: null };

/** Stored answers, whatever was saved before. */
export function answersOf(value: unknown): Answers {
  const parsed = answersSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_ANSWERS;
}

export type Question = 'niu' | 'contacts' | 'donation' | 'donor' | 'ubaAccount';

const filled = (value: string, min = 2) => value.trim().length >= min;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
