import { describe, expect, it } from 'vitest';

import { buildChecklist, progressOf, type ChecklistSection } from '@/features/checklist/lib/build-checklist';
import { DEFAULT_CHECKLIST_FORM, fromCrsForm, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { DEFAULT_FORM } from '@/features/crs/lib/crs-form';

const listFor = (answers: Partial<ChecklistForm>) => buildChecklist({ ...DEFAULT_CHECKLIST_FORM, ...answers });
/** `who:document` → need, for the whole list. */
const needs = (sections: ChecklistSection[]) =>
  Object.fromEntries(sections.flatMap((s) => s.items.map((item) => [item.key, item.need])));
const item = (sections: ChecklistSection[], key: string) =>
  sections.flatMap((s) => s.items).find((i) => i.key === key);

describe('buildChecklist', () => {
  it('asks a single candidate abroad for the core documents, funds included', () => {
    const list = listFor({});

    expect(list.map((s) => s.id)).toEqual(['identity', 'forms', 'language', 'education', 'work', 'funds', 'police', 'medical', 'special']);
    expect(needs(list)).toMatchObject({
      'you:passport': 'mandatory',
      'you:photo': 'mandatory',
      'you:birthCertificate': 'recommended',
      'you:personalHistory': 'mandatory',
      'you:languageResults': 'mandatory',
      'you:eca': 'mandatory',
      'you:foreignDiplomas': 'recommended',
      'you:referenceLetters': 'mandatory',
      'you:payslips': 'recommended',
      'you:socialSecurity': 'recommended',
      'you:salaryStatements': 'recommended',
      'you:bankLetter': 'mandatory',
      'you:bankStatements': 'recommended',
      'you:policeCertificate': 'mandatory',
      'you:medicalExam': 'mandatory',
      'you:explanationLetter': 'recommended',
    });
    for (const key of ['you:marriageCertificate', 'spouse:passport', 'children:passport', 'you:fundsExemptionLetter', 'you:workPermit', 'you:jobOfferLetter'])
      expect(item(list, key)).toBeUndefined();
  });

  it('lists the mandatory documents of a section before the recommended ones', () => {
    for (const section of listFor({ maritalStatus: 'married', spouseAccompanying: true, children: 2 })) {
      const needsInOrder = section.items.map((i) => i.need);
      expect(needsInOrder).toEqual([...needsInOrder].sort()); // 'mandatory' < 'recommended'
    }
  });

  it('exempts a Canadian Experience Class candidate from funds, asking for a letter instead', () => {
    const list = listFor({ canadianWork: true });

    expect(needs(list)).toMatchObject({
      'you:fundsExemptionLetter': 'mandatory',
      'you:bankLetter': 'recommended',
      'you:workPermit': 'mandatory',
      'you:canadianTaxRecords': 'recommended',
    });
  });

  it('exempts someone authorized to work in Canada with a job offer, not with only one of them', () => {
    expect(needs(listFor({ authorizedToWork: true, jobOffer: true }))['you:fundsExemptionLetter']).toBe('mandatory');
    expect(needs(listFor({ jobOffer: true }))['you:bankLetter']).toBe('mandatory');
    expect(needs(listFor({ authorizedToWork: true }))['you:bankLetter']).toBe('mandatory');
  });

  it('adds the spouse’s and each child’s documents for a married candidate with two children', () => {
    const list = listFor({ maritalStatus: 'married', spouseAccompanying: true, children: 2 });

    expect(needs(list)).toMatchObject({
      'you:marriageCertificate': 'mandatory',
      'spouse:passport': 'mandatory',
      'spouse:photo': 'mandatory',
      'spouse:personalHistory': 'mandatory',
      'spouse:policeCertificate': 'mandatory',
      'spouse:medicalExam': 'mandatory',
      'children:passport': 'mandatory',
      'children:birthCertificate': 'mandatory',
      'children:medicalExam': 'mandatory',
    });
    expect(item(list, 'children:passport')?.count).toBe(2);
    // No points claimed for the spouse: no ECA or test of theirs.
    expect(item(list, 'spouse:eca')).toBeUndefined();
    expect(item(list, 'spouse:languageResults')).toBeUndefined();
  });

  it('asks for the spouse’s ECA and test only when points are claimed for them', () => {
    const list = listFor({ maritalStatus: 'commonLaw', spouseAccompanying: true, spouseClaimsPoints: true });

    expect(needs(list)).toMatchObject({
      'you:commonLawProof': 'mandatory',
      'spouse:eca': 'mandatory',
      'spouse:languageResults': 'mandatory',
    });
  });

  it('leaves out a spouse who doesn’t come, but keeps the proof of the marriage', () => {
    const list = listFor({ maritalStatus: 'married', spouseAccompanying: false, spouseClaimsPoints: true });

    expect(needs(list)['you:marriageCertificate']).toBe('mandatory');
    expect(list.flatMap((s) => s.items).filter((i) => i.who === 'spouse')).toEqual([]);
  });

  it('asks a divorced or widowed candidate to prove the earlier union ended', () => {
    expect(needs(listFor({ maritalStatus: 'divorced' }))['you:previousUnionProof']).toBe('mandatory');
    expect(needs(listFor({ maritalStatus: 'widowed' }))['you:previousUnionProof']).toBe('mandatory');
    expect(needs(listFor({ maritalStatus: 'married', previousUnion: true }))['you:previousUnionProof']).toBe('mandatory');
    expect(item(listFor({ maritalStatus: 'single' }), 'you:previousUnionProof')).toBeUndefined();
  });

  it('counts one police certificate per country lived in', () => {
    expect(item(listFor({ policeCountries: 3 }), 'you:policeCertificate')?.count).toBe(3);
    expect(item(listFor({ policeCountries: 1 }), 'you:policeCertificate')?.count).toBeUndefined();
  });

  it('adds the job offer, nomination, certificate of qualification, sibling and representative documents', () => {
    const list = listFor({
      jobOffer: true,
      provincialNomination: true,
      certificateOfQualification: true,
      siblingInCanada: true,
      representative: true,
    });

    expect(needs(list)).toMatchObject({
      'you:jobOfferLetter': 'mandatory',
      'you:nominationCertificate': 'mandatory',
      'you:qualificationCertificate': 'mandatory',
      'you:siblingProof': 'mandatory',
      'you:representativeForm': 'mandatory',
    });
  });

  it('asks a self-employed candidate for proof of the business instead of reference letters', () => {
    const list = listFor({ foreignWork: false, selfEmployed: true });

    expect(needs(list)['you:selfEmployedProof']).toBe('mandatory');
    expect(item(list, 'you:referenceLetters')).toBeUndefined();
    expect(item(list, 'you:payslips')).toBeUndefined();
  });

  it('asks for the Canadian diploma, and no ECA, for studies in Canada only', () => {
    const list = listFor({ foreignEducation: false, canadianEducation: true });

    expect(needs(list)['you:canadianDiploma']).toBe('mandatory');
    expect(item(list, 'you:eca')).toBeUndefined();
  });
});

describe('progressOf', () => {
  it('counts the ticked documents, overall and among the mandatory ones', () => {
    const list = listFor({});
    const progress = progressOf(list, new Set(['you:passport', 'you:payslips', 'stale:key']));

    expect(progress.ready).toBe(2);
    expect(progress.mandatoryReady).toBe(1);
    expect(progress.total).toBe(list.flatMap((s) => s.items).length);
  });
});

describe('fromCrsForm', () => {
  it('takes what the CRS answers already say', () => {
    expect(
      fromCrsForm({
        ...DEFAULT_FORM,
        maritalStatus: 'married',
        spouseAccompanying: true,
        spouseEducation: 'bachelors',
        canadianWorkYears: 2,
        foreignWorkYears: 0,
        canadianStudy: 'oneOrTwoYears',
        provincialNomination: true,
        siblingInCanada: true,
        highWageJobOffer: '1.3x',
      }),
    ).toEqual({
      maritalStatus: 'married',
      spouseAccompanying: true,
      spouseClaimsPoints: true,
      canadianEducation: true,
      foreignEducation: false,
      secondLanguage: false,
      foreignWork: false,
      canadianWork: true,
      jobOffer: true,
      provincialNomination: true,
      certificateOfQualification: false,
      siblingInCanada: true,
    });
  });

  it('doesn’t count a spouse who is already Canadian as coming', () => {
    const answers = fromCrsForm({ ...DEFAULT_FORM, maritalStatus: 'married', spouseAccompanying: true, spouseIsCanadianCitizenOrPR: true });
    expect(answers.spouseAccompanying).toBe(false);
    expect(answers.spouseClaimsPoints).toBe(false);
  });
});
