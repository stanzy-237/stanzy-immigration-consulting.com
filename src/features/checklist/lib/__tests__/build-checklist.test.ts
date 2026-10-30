import { describe, expect, it } from 'vitest';

import { buildChecklist, progressOf, READY_KEY_PATTERN, type ChecklistPerson } from '@/features/checklist/lib/build-checklist';
import { checklistFees } from '@/features/checklist/lib/checklist-fees';
import { DEFAULT_CHECKLIST_FORM, fromCrsForm, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { DEFAULT_FORM } from '@/features/crs/lib/crs-form';

/** A single candidate abroad: one job, one country. */
const SINGLE: ChecklistForm = {
  ...DEFAULT_CHECKLIST_FORM,
  jobs: [{ title: 'Responsable QHSE', inCanada: false, selfEmployed: false }],
  countries: ['Cameroun'],
};
/** A married couple coming with three children, as on an IRCC personal checklist. */
const FAMILY: ChecklistForm = {
  ...SINGLE,
  maritalStatus: 'married',
  spouseAccompanying: true,
  children: 3,
  spouseJobs: ['Commerciale'],
  spouseCountries: ['Cameroun'],
};

const listFor = (answers: Partial<ChecklistForm>) => buildChecklist({ ...SINGLE, ...answers });
const person = (people: ChecklistPerson[], id: string) => people.find((p) => p.id === id)!;
/** A person's slots as `slot[ – label]`, with a star for required ones. */
const slotsOf = (people: ChecklistPerson[], id: string) =>
  person(people, id).slots.map((s) => `${s.required ? '*' : ''}${s.slot}${s.label ? ` – ${s.label}` : ''}`);
/** A slot's documents as `document:need`. */
const piecesOf = (people: ChecklistPerson[], slotKey: string) =>
  people
    .flatMap((p) => p.slots)
    .find((s) => s.key === slotKey)
    ?.pieces.map((p) => `${p.document}:${p.need}`);

describe('buildChecklist', () => {
  it('lists the principal applicant’s slots in IRCC’s order, required ones starred', () => {
    expect(slotsOf(listFor({}), 'principal')).toEqual([
      '*passport',
      '*medical',
      '*education',
      '*job – Responsable QHSE',
      '*police – Cameroun',
      '*funds',
      '*photo',
      'optional',
      '*clientInfo',
    ]);
  });

  it('puts the ECA, the diploma, the transcripts and the language results in « Études »', () => {
    expect(piecesOf(listFor({ secondLanguage: true }), 'principal:education')).toEqual([
      'eca:mandatory',
      'diplomas:mandatory',
      'languageResults:mandatory',
      'secondLanguageResults:mandatory',
      'transcripts:recommended',
    ]);
    expect(piecesOf(listFor({ foreignEducation: false, canadianEducation: true }), 'principal:education')).toEqual([
      'canadianDiploma:mandatory',
      'languageResults:mandatory',
      'transcripts:recommended',
    ]);
  });

  it('gives each job its own employment record: the letter starred, the rest recommended', () => {
    const people = listFor({
      jobs: [
        { title: 'Responsable QHSE', inCanada: false, selfEmployed: false },
        { title: 'Analyste', inCanada: true, selfEmployed: false },
        { title: 'Consultant', inCanada: false, selfEmployed: true },
      ],
    });

    expect(piecesOf(people, 'principal:job-0')).toEqual([
      'referenceLetters:mandatory',
      'payslips:recommended',
      'employmentContract:recommended',
      'socialSecurity:recommended',
      'salaryStatements:recommended',
    ]);
    expect(piecesOf(people, 'principal:job-1')).toEqual([
      'referenceLetters:mandatory',
      'workPermit:mandatory',
      'payslips:recommended',
      'employmentContract:recommended',
      'salaryStatements:recommended',
      'canadianTaxRecords:recommended',
    ]);
    expect(piecesOf(people, 'principal:job-2')).toEqual(['selfEmployedProof:mandatory', 'socialSecurity:recommended']);
  });

  it('gives each country its own police certificate', () => {
    expect(slotsOf(listFor({ countries: ['Cameroun', 'Gabon'] }), 'principal')).toEqual(
      expect.arrayContaining(['*police – Cameroun', '*police – Gabon']),
    );
  });

  it('asks a family for the spouse’s and each child’s own documents, as IRCC does', () => {
    const people = buildChecklist(FAMILY);

    expect(people.map((p) => p.id)).toEqual(['principal', 'spouse', 'child1', 'child2', 'child3']);
    expect(slotsOf(people, 'principal')).toContain('*marriage');
    expect(slotsOf(people, 'spouse')).toEqual([
      '*passport',
      '*medical',
      '*job – Commerciale',
      '*police – Cameroun',
      '*photo',
      'optional',
      '*clientInfo',
    ]);
    expect(slotsOf(people, 'child2')).toEqual(['*passport', '*photo', '*medical', '*birth']);
    expect(person(people, 'child3').number).toBe(3);
  });

  it('adds the spouse’s « Études » only when points are claimed for them', () => {
    expect(slotsOf(buildChecklist(FAMILY), 'spouse')).not.toContain('*education');
    expect(piecesOf(buildChecklist({ ...FAMILY, spouseClaimsPoints: true }), 'spouse:education')).toEqual([
      'eca:mandatory',
      'diplomas:mandatory',
      'languageResults:mandatory',
      'transcripts:recommended',
    ]);
  });

  it('leaves out a spouse who doesn’t come, but keeps the proof of the marriage', () => {
    const people = buildChecklist({ ...FAMILY, spouseAccompanying: false, children: 0 });

    expect(people.map((p) => p.id)).toEqual(['principal']);
    expect(slotsOf(people, 'principal')).toContain('*marriage');
  });

  it('asks for the common-law proof, or the end of an earlier union', () => {
    expect(slotsOf(listFor({ maritalStatus: 'commonLaw' }), 'principal')).toContain('*commonLaw');
    expect(slotsOf(listFor({ maritalStatus: 'divorced' }), 'principal')).toContain('*previousUnion');
    expect(slotsOf(listFor({ maritalStatus: 'married', previousUnion: true }), 'principal')).toContain('*previousUnion');
    expect(slotsOf(listFor({}), 'principal')).not.toContain('*previousUnion');
  });

  it('asks for funds, or for the exemption letter with the bank letter recommended', () => {
    expect(piecesOf(listFor({}), 'principal:funds')).toEqual(['bankLetter:mandatory', 'bankStatements:recommended']);
    expect(piecesOf(listFor({ canadianWork: true }), 'principal:funds')).toEqual([
      'fundsExemptionLetter:mandatory',
      'bankLetter:recommended',
      'bankStatements:recommended',
    ]);
    expect(piecesOf(listFor({ authorizedToWork: true, jobOffer: true }), 'principal:funds')?.[0]).toBe('fundsExemptionLetter:mandatory');
    expect(piecesOf(listFor({ jobOffer: true }), 'principal:funds')?.[0]).toBe('bankLetter:mandatory');
  });

  it('adds the job offer, nomination, certificate of qualification, sibling and representative slots', () => {
    const slots = slotsOf(
      listFor({ jobOffer: true, provincialNomination: true, certificateOfQualification: true, siblingInCanada: true, representative: true }),
      'principal',
    );
    expect(slots).toEqual(expect.arrayContaining(['*jobOffer', '*nomination', '*qualification', '*sibling', '*representative']));
  });

  it('keys every tick by person, slot and document, as the router accepts them', () => {
    const keys = buildChecklist({ ...FAMILY, children: 10, countries: ['A', 'B', 'C'] }).flatMap((p) => p.slots.flatMap((s) => s.pieces.map((x) => x.key)));

    expect(keys).toContain('principal:job-0:payslips');
    expect(keys).toContain('child10:birth:birthCertificate');
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(READY_KEY_PATTERN);
  });
});

describe('progressOf', () => {
  it('counts the ticked documents, overall and among the mandatory ones', () => {
    const people = listFor({});
    const progress = progressOf(people, new Set(['principal:passport:passport', 'principal:job-0:payslips', 'stale:key']));

    expect(progress.ready).toBe(2);
    expect(progress.mandatoryReady).toBe(1);
    expect(progress.total).toBe(people.flatMap((p) => p.slots.flatMap((s) => s.pieces)).length);
  });
});

describe('checklistFees', () => {
  it('adds up IRCC’s fees for a couple with three children', () => {
    // 990 + 600 + 170 (biometrics, family rate) + 990 + 600 + 3 × 270
    expect(checklistFees(FAMILY).total).toBe(4_160);
    expect(checklistFees(FAMILY).rows.map((row) => row.id)).toEqual([
      'processing',
      'rprf',
      'biometricsFamily',
      'spouseProcessing',
      'spouseRprf',
      'childProcessing',
    ]);
  });

  it('charges one person’s biometrics to a candidate alone', () => {
    expect(checklistFees(SINGLE)).toEqual({
      rows: [
        { id: 'processing', quantity: 1, unit: 990 },
        { id: 'rprf', quantity: 1, unit: 600 },
        { id: 'biometrics', quantity: 1, unit: 85 },
      ],
      total: 1_675,
    });
  });
});

describe('fromCrsForm', () => {
  it('takes what the CRS answers already say, with a job to name for each kind of experience', () => {
    expect(
      fromCrsForm({
        ...DEFAULT_FORM,
        maritalStatus: 'married',
        spouseAccompanying: true,
        spouseEducation: 'bachelors',
        canadianWorkYears: 2,
        foreignWorkYears: 1,
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
      jobs: [
        { title: '', inCanada: false, selfEmployed: false },
        { title: '', inCanada: true, selfEmployed: false },
      ],
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
