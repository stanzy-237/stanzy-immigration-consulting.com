import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST_FORM } from '@/features/checklist/lib/checklist-form';
import { planDossier } from '@/features/accompagnement/lib/dossier-plan';
import {
  AREAS,
  helpFor,
  interestAnswersSchema,
  levelOf,
  startStageOf,
  type InterestInput,
} from '@/features/accompagnement/lib/interest-schema';
import { DEFAULT_FORM, toProfile } from '@/features/crs/lib/crs-form';

const progress = {
  age: 29,
  citizenship: 'Cameroun',
  residence: 'CM' as const,
  residenceOther: '',
  languageTest: 'none' as const,
  ede: false,
  eeProfile: false,
  ita: false,
  itaDate: null,
};
const areas = Object.fromEntries(AREAS.map((area) => [area, { answer: 'have', note: '' }])) as InterestInput['areas'];
const checklist = {
  ...DEFAULT_CHECKLIST_FORM,
  jobs: [{ title: 'Comptable', inCanada: false, selfEmployed: false }],
  countries: ['Cameroun'],
};
const experience = {
  title: 'Comptable',
  company: 'Brasseries du Cameroun',
  cnp: '11100',
  startOn: '2019-03-01',
  endOn: null as string | null,
};
const work = { phone: '+237 6 92 24 53 94', experiences: [experience] };
const answers = (extra: Partial<InterestInput> = {}): InterestInput => ({
  checklist,
  progress,
  work,
  areas,
  crs: toProfile(DEFAULT_FORM),
  ...extra,
});

describe('the Niveau', () => {
  it('is A from the start, B with the language test and the EDE, C once in the pool', () => {
    expect(levelOf(answers())).toBe('A');
    expect(levelOf(answers({ progress: { ...progress, languageTest: 'tcf' } }))).toBe('A');
    expect(levelOf(answers({ progress: { ...progress, languageTest: 'tcf', ede: true } }))).toBe('B');
    expect(levelOf(answers({ progress: { ...progress, eeProfile: true } }))).toBe('C');
  });

  it('needs no EDE for studies made in Canada only', () => {
    const canadian = { ...checklist, foreignEducation: false, canadianEducation: true };
    expect(levelOf(answers({ checklist: canadian, progress: { ...progress, languageTest: 'ielts' } }))).toBe('B');
  });

  it('opens the Dossier at its stage: A at the start, B at the profile, C in the pool or at the ITA', () => {
    expect(startStageOf('A', false)).toBe('evaluation');
    expect(startStageOf('B', false)).toBe('profil-ee');
    expect(startStageOf('C', false)).toBe('bassin');
    expect(startStageOf('C', true)).toBe('ita');
  });
});

describe('the Demande', () => {
  it('offers « Stanzy s’en charge » in Cameroon only, and an ITA only with a profile', () => {
    const stanzy = { ...areas, funds: { answer: 'stanzy' as const, note: '' } };
    expect(interestAnswersSchema.safeParse(answers({ areas: stanzy })).success).toBe(true);
    expect(
      interestAnswersSchema.safeParse(answers({ areas: stanzy, progress: { ...progress, residence: 'CA' } })).success,
    ).toBe(false);
    expect(interestAnswersSchema.safeParse(answers({ progress: { ...progress, ita: true } })).success).toBe(false);
  });
});

describe('their contact and work experience (#147)', () => {
  const parse = (patch: Partial<typeof work>) => interestAnswersSchema.safeParse(answers({ work: { ...work, ...patch } }));

  it('takes a phone number, and each job’s company, CNP code and dates, the current one open', () => {
    expect(parse({}).success).toBe(true);
    const ended = { ...experience, endOn: '2023-06-30' };
    expect(parse({ experiences: [ended, { ...experience, title: 'Caissier', startOn: '2016-01-01', endOn: '2018-12-31' }] }).success).toBe(true);
  });

  it('refuses a missing phone, a CNP code that isn’t 5 digits, and an end before the start', () => {
    expect(parse({ phone: '' }).success).toBe(false);
    expect(parse({ phone: 'appelez-moi' }).success).toBe(false);
    expect(parse({ experiences: [{ ...experience, cnp: '1110' }] }).success).toBe(false);
    expect(parse({ experiences: [{ ...experience, cnp: 'ABCDE' }] }).success).toBe(false);
    expect(parse({ experiences: [{ ...experience, company: '' }] }).success).toBe(false);
    expect(parse({ experiences: [{ ...experience, endOn: '2018-01-01' }] }).success).toBe(false);
  });
});

describe('the Dossier plan', () => {
  it('names the Sections and Documents like the Checklist, with the Demande’s answers on them', () => {
    const sections = planDossier(
      answers({ areas: { ...areas, funds: { answer: 'stanzy', note: 'Mon relevé est à 4 mois.' }, language: { answer: 'missing', note: '' } } }),
      'fr',
    );
    expect(sections.map((section) => section.title)).toContain('Preuve de ressources financières suffisantes – Requérant principal');
    expect(sections.map((section) => section.title)).toContain('Relevé d’emploi – Comptable – Requérant principal');
    // Named in each language too, for whoever reads the Dossier.
    expect(sections.find((section) => section.title.startsWith('Preuve de ressources'))!.titles).toEqual({
      fr: 'Preuve de ressources financières suffisantes – Requérant principal',
      en: expect.stringMatching(/– Principal applicant$/),
    });

    const funds = sections.find((section) => section.title.startsWith('Preuve de ressources'))!;
    expect(funds.documents[0]).toMatchObject({
      kind: 'bankLetter',
      need: 'mandatory',
      missing: true,
      clientNote: 'Mon relevé est à 4 mois.',
      stanzy: true,
    });
    // Recommended documents aren't asked of Stanzy.
    expect(funds.documents.find((document) => document.kind === 'bankStatements')).toMatchObject({ need: 'recommended', stanzy: false });

    const education = sections.find((section) => section.title.startsWith('Études'))!;
    expect(education.documents.find((document) => document.kind === 'languageResults')).toMatchObject({ missing: true, stanzy: false });
    expect(education.documents.find((document) => document.kind === 'diplomas')).toMatchObject({ missing: false });
  });

  it('points a missing language test to the TCF, missing diplomas to the EDE', () => {
    expect(helpFor('languageResults')).toBe('tcf');
    expect(helpFor('diplomas')).toBe('ede');
    expect(helpFor('passport')).toBeNull();
  });
});
