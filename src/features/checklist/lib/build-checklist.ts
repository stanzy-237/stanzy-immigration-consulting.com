import { spouseComes, type ChecklistForm } from '@/features/checklist/lib/checklist-form';

/** The parts of the list, in the order of IRCC's application. */
export const SECTIONS = ['identity', 'forms', 'language', 'education', 'work', 'funds', 'police', 'medical', 'special'] as const;
export type SectionId = (typeof SECTIONS)[number];

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
  'languageResults',
  'secondLanguageResults',
  'eca',
  'foreignDiplomas',
  'canadianDiploma',
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

/** Whose document it is: the candidate's, the spouse's or partner's, or each child's. */
export type Who = 'you' | 'spouse' | 'children';
/** ★ Obligatoire: IRCC asks for it. Recommandé: it makes the file stronger. */
export type Need = 'mandatory' | 'recommended';

export type ChecklistItem = {
  /** What a tick is saved under: `who:document`. */
  key: string;
  document: DocumentId;
  who: Who;
  need: Need;
  /** How many: one per child, one per country… */
  count?: number;
};

export type ChecklistSection = { id: SectionId; items: ChecklistItem[] };

type Rule = { document: DocumentId; who?: Who; need: Need | null; count?: number };

/** The documents of one section for these answers; `need: null` leaves a document out. */
function rulesFor(section: SectionId, form: ChecklistForm): Rule[] {
  const spouse = spouseComes(form);
  const kids = form.children;
  const spouseOnly = (need: Need): Need | null => (spouse ? need : null);
  const childrenOnly = (need: Need): Need | null => (kids > 0 ? need : null);
  const pastUnion =
    form.previousUnion || ['divorced', 'widowed', 'annulled'].includes(form.maritalStatus);
  const employed = form.foreignWork || form.canadianWork || !form.selfEmployed;
  const fundsExempt = form.canadianWork || (form.authorizedToWork && form.jobOffer);
  const spousePoints = spouse && form.spouseClaimsPoints;

  switch (section) {
    case 'identity':
      return [
        { document: 'passport', need: 'mandatory' },
        { document: 'passport', who: 'spouse', need: spouseOnly('mandatory') },
        { document: 'passport', who: 'children', need: childrenOnly('mandatory'), count: kids },
        { document: 'photo', need: 'mandatory' },
        { document: 'photo', who: 'spouse', need: spouseOnly('mandatory') },
        { document: 'photo', who: 'children', need: childrenOnly('mandatory'), count: kids },
        { document: 'birthCertificate', need: 'recommended' },
        { document: 'birthCertificate', who: 'spouse', need: spouseOnly('recommended') },
        { document: 'birthCertificate', who: 'children', need: childrenOnly('mandatory'), count: kids },
        {
          document: 'marriageCertificate',
          need: form.maritalStatus === 'married' ? 'mandatory' : form.maritalStatus === 'separated' ? 'recommended' : null,
        },
        { document: 'commonLawProof', need: form.maritalStatus === 'commonLaw' ? 'mandatory' : null },
        { document: 'previousUnionProof', need: pastUnion ? 'mandatory' : null },
      ];
    case 'forms':
      return [
        { document: 'personalHistory', need: 'mandatory' },
        { document: 'personalHistory', who: 'spouse', need: spouseOnly('mandatory') },
        { document: 'familyInformation', need: 'mandatory' },
        { document: 'familyInformation', who: 'spouse', need: spouseOnly('mandatory') },
        { document: 'representativeForm', need: form.representative ? 'mandatory' : null },
      ];
    case 'language':
      return [
        { document: 'languageResults', need: 'mandatory' },
        { document: 'secondLanguageResults', need: form.secondLanguage ? 'mandatory' : null },
        { document: 'languageResults', who: 'spouse', need: spousePoints ? 'mandatory' : null },
      ];
    case 'education':
      return [
        { document: 'eca', need: form.foreignEducation ? 'mandatory' : null },
        { document: 'canadianDiploma', need: form.canadianEducation ? 'mandatory' : null },
        { document: 'foreignDiplomas', need: form.foreignEducation ? 'recommended' : null },
        { document: 'eca', who: 'spouse', need: spousePoints ? 'mandatory' : null },
        { document: 'foreignDiplomas', who: 'spouse', need: spousePoints ? 'recommended' : null },
      ];
    case 'work':
      return [
        { document: 'referenceLetters', need: employed ? 'mandatory' : null },
        { document: 'selfEmployedProof', need: form.selfEmployed ? 'mandatory' : null },
        { document: 'workPermit', need: form.canadianWork || form.authorizedToWork ? 'mandatory' : null },
        { document: 'payslips', need: employed ? 'recommended' : null },
        { document: 'employmentContract', need: employed ? 'recommended' : null },
        { document: 'socialSecurity', need: form.foreignWork || form.selfEmployed ? 'recommended' : null },
        { document: 'salaryStatements', need: employed ? 'recommended' : null },
        { document: 'canadianTaxRecords', need: form.canadianWork ? 'recommended' : null },
        { document: 'resume', need: 'recommended' },
      ];
    case 'funds':
      return [
        { document: 'bankLetter', need: fundsExempt ? 'recommended' : 'mandatory' },
        { document: 'fundsExemptionLetter', need: fundsExempt ? 'mandatory' : null },
        { document: 'bankStatements', need: 'recommended' },
      ];
    case 'police':
      return [
        { document: 'policeCertificate', need: 'mandatory', count: form.policeCountries },
        { document: 'policeCertificate', who: 'spouse', need: spouseOnly('mandatory') },
      ];
    case 'medical':
      return [
        { document: 'medicalExam', need: 'mandatory' },
        { document: 'medicalExam', who: 'spouse', need: spouseOnly('mandatory') },
        { document: 'medicalExam', who: 'children', need: childrenOnly('mandatory'), count: kids },
      ];
    case 'special':
      return [
        { document: 'jobOfferLetter', need: form.jobOffer ? 'mandatory' : null },
        { document: 'nominationCertificate', need: form.provincialNomination ? 'mandatory' : null },
        { document: 'qualificationCertificate', need: form.certificateOfQualification ? 'mandatory' : null },
        { document: 'siblingProof', need: form.siblingInCanada ? 'mandatory' : null },
        { document: 'explanationLetter', need: 'recommended' },
      ];
  }
}

/**
 * The documents to prepare for these answers, section by section: the
 * mandatory ones (★) first, then the recommended ones. Sections left empty are
 * dropped.
 */
export function buildChecklist(form: ChecklistForm): ChecklistSection[] {
  return SECTIONS.map((id) => {
    const items = rulesFor(id, form)
      .filter((rule): rule is Rule & { need: Need } => rule.need !== null)
      .map(({ document, who = 'you', need, count }): ChecklistItem => ({
        key: `${who}:${document}`,
        document,
        who,
        need,
        ...(count !== undefined && count > 1 ? { count } : {}),
      }));
    const ranked = [
      ...items.filter((item) => item.need === 'mandatory'),
      ...items.filter((item) => item.need === 'recommended'),
    ];
    return { id, items: ranked };
  }).filter((section) => section.items.length > 0);
}

/** How many of the list's documents are ticked « Prêt », overall and among the mandatory ones. */
export function progressOf(sections: ChecklistSection[], ready: ReadonlySet<string>) {
  const items = sections.flatMap((section) => section.items);
  const mandatory = items.filter((item) => item.need === 'mandatory');
  return {
    ready: items.filter((item) => ready.has(item.key)).length,
    total: items.length,
    mandatoryReady: mandatory.filter((item) => ready.has(item.key)).length,
    mandatoryTotal: mandatory.length,
  };
}
