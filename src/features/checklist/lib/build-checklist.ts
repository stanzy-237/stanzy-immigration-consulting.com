import { spouseComes, type ChecklistForm } from '@/features/checklist/lib/checklist-form';

/** The documents a slot can hold; each has its own guide and « Prêt » tick. */
export const DOCUMENTS = [
  'passport',
  'photo',
  'birthCertificate',
  'marriageCertificate',
  'commonLawProof',
  'previousUnionProof',
  'personalHistory',
  'familyInformation',
  'representativeForm',
  'eca',
  'diplomas',
  'transcripts',
  'canadianDiploma',
  'languageResults',
  'secondLanguageResults',
  'referenceLetters',
  'selfEmployedProof',
  'workPermit',
  'payslips',
  'employmentContract',
  'socialSecurity',
  'salaryStatements',
  'canadianTaxRecords',
  'resume',
  'bankLetter',
  'fundsExemptionLetter',
  'bankStatements',
  'policeCertificate',
  'medicalExam',
  'jobOfferLetter',
  'nominationCertificate',
  'qualificationCertificate',
  'siblingProof',
  'explanationLetter',
] as const;
export type DocumentId = (typeof DOCUMENTS)[number];

/** IRCC's upload slots, named as in the personal checklist after the ITA. */
export const SLOTS = [
  'passport',
  'marriage',
  'commonLaw',
  'previousUnion',
  'medical',
  'education',
  'job',
  'police',
  'funds',
  'photo',
  'birth',
  'jobOffer',
  'nomination',
  'qualification',
  'sibling',
  'representative',
  'optional',
  'clientInfo',
] as const;
export type SlotId = (typeof SLOTS)[number];

/** ★ Obligatoire: IRCC asks for it. Recommandé: it makes the file stronger. */
export type Need = 'mandatory' | 'recommended';

export type PersonId = 'principal' | 'spouse' | `child${number}`;

export type ChecklistPiece = {
  /** What a tick is saved under: `person:slot:document`. */
  key: string;
  document: DocumentId;
  need: Need;
};

export type ChecklistSlot = {
  /** `person:slot`, with the job's or country's position: `principal:job-2`. */
  key: string;
  slot: SlotId;
  /** The job title or the country, shown after the slot's name. */
  label?: string;
  /** « * … (requis) »: the slot holds a mandatory document. */
  required: boolean;
  pieces: ChecklistPiece[];
};

export type ChecklistPerson = {
  id: PersonId;
  kind: 'principal' | 'spouse' | 'child';
  /** A child's number: Enfant 1, Enfant 2… */
  number?: number;
  slots: ChecklistSlot[];
};

type Doc = [DocumentId, Need | null];
type SlotRule = { slot: SlotId; index?: number; label?: string; docs: Doc[] };

const when = (condition: boolean, need: Need): Need | null => (condition ? need : null);

function slot(person: PersonId, { slot: id, index, label, docs }: SlotRule): ChecklistSlot | null {
  const key = `${person}:${id}${index === undefined ? '' : `-${index}`}`;
  const kept = docs.filter((doc): doc is [DocumentId, Need] => doc[1] !== null);
  if (kept.length === 0) return null;
  const pieces = [
    ...kept.filter(([, need]) => need === 'mandatory'),
    ...kept.filter(([, need]) => need === 'recommended'),
  ].map(([document, need]) => ({ key: `${key}:${document}`, document, need }));
  return { key, slot: id, ...(label ? { label } : {}), required: pieces.some((p) => p.need === 'mandatory'), pieces };
}

const slots = (person: PersonId, rules: SlotRule[]): ChecklistSlot[] =>
  rules.map((rule) => slot(person, rule)).filter((s): s is ChecklistSlot => s !== null);

/** A job's « Relevé d'emploi »: the employer's letter, or proof of the business, and what backs it up. */
function jobDocs({ inCanada, selfEmployed }: { inCanada: boolean; selfEmployed: boolean }): Doc[] {
  return [
    ['referenceLetters', when(!selfEmployed, 'mandatory')],
    ['selfEmployedProof', when(selfEmployed, 'mandatory')],
    ['workPermit', when(inCanada, 'mandatory')],
    ['payslips', when(!selfEmployed, 'recommended')],
    ['employmentContract', when(!selfEmployed, 'recommended')],
    ['socialSecurity', when(!inCanada, 'recommended')],
    ['salaryStatements', when(!selfEmployed, 'recommended')],
    ['canadianTaxRecords', when(inCanada, 'recommended')],
  ];
}

const policeSlots = (countries: string[]): SlotRule[] =>
  countries.map((country, index) => ({ slot: 'police', index, label: country, docs: [['policeCertificate', 'mandatory']] }));

/** Everyone's identity slots: passport, medical exam, photo. */
const identity = {
  passport: { slot: 'passport', docs: [['passport', 'mandatory']] },
  medical: { slot: 'medical', docs: [['medicalExam', 'mandatory']] },
  photo: { slot: 'photo', docs: [['photo', 'mandatory']] },
} as const satisfies Record<string, SlotRule>;

function principal(form: ChecklistForm): ChecklistPerson {
  const pastUnion = form.previousUnion || ['divorced', 'widowed', 'annulled'].includes(form.maritalStatus);
  const fundsExempt = form.canadianWork || (form.authorizedToWork && form.jobOffer);
  return {
    id: 'principal',
    kind: 'principal',
    slots: slots('principal', [
      identity.passport,
      {
        slot: 'marriage',
        docs: [['marriageCertificate', form.maritalStatus === 'married' ? 'mandatory' : form.maritalStatus === 'separated' ? 'recommended' : null]],
      },
      { slot: 'commonLaw', docs: [['commonLawProof', when(form.maritalStatus === 'commonLaw', 'mandatory')]] },
      { slot: 'previousUnion', docs: [['previousUnionProof', when(pastUnion, 'mandatory')]] },
      identity.medical,
      {
        slot: 'education',
        docs: [
          ['eca', when(form.foreignEducation, 'mandatory')],
          ['diplomas', when(form.foreignEducation, 'mandatory')],
          ['canadianDiploma', when(form.canadianEducation, 'mandatory')],
          ['languageResults', 'mandatory'],
          ['secondLanguageResults', when(form.secondLanguage, 'mandatory')],
          ['transcripts', 'recommended'],
        ],
      },
      ...form.jobs.map((job, index): SlotRule => ({ slot: 'job', index, label: job.title, docs: jobDocs(job) })),
      ...policeSlots(form.countries),
      {
        slot: 'funds',
        docs: [
          ['bankLetter', fundsExempt ? 'recommended' : 'mandatory'],
          ['fundsExemptionLetter', when(fundsExempt, 'mandatory')],
          ['bankStatements', 'recommended'],
        ],
      },
      identity.photo,
      { slot: 'jobOffer', docs: [['jobOfferLetter', when(form.jobOffer, 'mandatory')]] },
      { slot: 'nomination', docs: [['nominationCertificate', when(form.provincialNomination, 'mandatory')]] },
      { slot: 'qualification', docs: [['qualificationCertificate', when(form.certificateOfQualification, 'mandatory')]] },
      { slot: 'sibling', docs: [['siblingProof', when(form.siblingInCanada, 'mandatory')]] },
      { slot: 'representative', docs: [['representativeForm', when(form.representative, 'mandatory')]] },
      {
        slot: 'optional',
        docs: [
          ['birthCertificate', 'recommended'],
          ['resume', 'recommended'],
          ['explanationLetter', 'recommended'],
        ],
      },
      { slot: 'clientInfo', docs: [['personalHistory', 'mandatory'], ['familyInformation', 'mandatory']] },
    ]),
  };
}

function spouse(form: ChecklistForm): ChecklistPerson {
  const points = form.spouseClaimsPoints;
  return {
    id: 'spouse',
    kind: 'spouse',
    slots: slots('spouse', [
      identity.passport,
      identity.medical,
      {
        slot: 'education',
        docs: [
          ['eca', when(points, 'mandatory')],
          ['diplomas', when(points, 'mandatory')],
          ['languageResults', when(points, 'mandatory')],
          ['transcripts', when(points, 'recommended')],
        ],
      },
      ...form.spouseJobs.map((title, index): SlotRule => ({
        slot: 'job',
        index,
        label: title,
        docs: jobDocs({ inCanada: false, selfEmployed: false }),
      })),
      ...policeSlots(form.spouseCountries),
      identity.photo,
      { slot: 'optional', docs: [['birthCertificate', 'recommended']] },
      { slot: 'clientInfo', docs: [['personalHistory', 'mandatory'], ['familyInformation', 'mandatory']] },
    ]),
  };
}

function child(number: number): ChecklistPerson {
  const id: PersonId = `child${number}`;
  return {
    id,
    kind: 'child',
    number,
    slots: slots(id, [identity.passport, identity.photo, identity.medical, { slot: 'birth', docs: [['birthCertificate', 'mandatory']] }]),
  };
}

/**
 * The documents to prepare for these answers, like IRCC's personal checklist:
 * the principal applicant, the accompanying spouse, then each child; for each,
 * IRCC's slots and the documents that go in them, mandatory (★) first.
 */
export function buildChecklist(form: ChecklistForm): ChecklistPerson[] {
  return [
    principal(form),
    ...(spouseComes(form) ? [spouse(form)] : []),
    ...Array.from({ length: form.children }, (_, i) => child(i + 1)),
  ];
}

/** How many documents are ticked « Prêt », overall and among the mandatory ones. */
export function progressOf(slotsOrPeople: ChecklistSlot[] | ChecklistPerson[], ready: ReadonlySet<string>) {
  const pieces = slotsOrPeople.flatMap((entry) => ('pieces' in entry ? entry.pieces : entry.slots.flatMap((s) => s.pieces)));
  const mandatory = pieces.filter((piece) => piece.need === 'mandatory');
  return {
    ready: pieces.filter((piece) => ready.has(piece.key)).length,
    total: pieces.length,
    mandatoryReady: mandatory.filter((piece) => ready.has(piece.key)).length,
    mandatoryTotal: mandatory.length,
  };
}

/** A tick's key, as the router accepts it: `principal:job-2:payslips`. */
export const READY_KEY_PATTERN = new RegExp(
  `^(principal|spouse|child(?:[1-9]|10)):(${SLOTS.join('|')})(?:-\\d{1,2})?:(${DOCUMENTS.join('|')})$`,
);
