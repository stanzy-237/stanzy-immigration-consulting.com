import { describe, expect, it } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { askedPrerequisites, EMPTY_ANSWERS, questionsLeft, type Answers } from '@/features/document-services/lib/requirements';
import { prerequisiteKey, prerequisitesOf } from '@/features/document-services/lib/service-schema';

const answered: Answers = {
  niu: 'M012345678901A',
  contacts: [{ name: 'Paul Mbarga', phone: '+237 690 00 00 00' }],
  donation: false,
  donor: null,
  ubaAccount: null,
};

describe('the proof of funds questionnaire', () => {
  it('asks the NIU, at least one emergency contact and whether the funds are a gift', () => {
    expect(questionsLeft('proofOfFunds', EMPTY_ANSWERS)).toEqual(['niu', 'contacts', 'donation']);
    expect(questionsLeft('proofOfFunds', answered)).toEqual([]);
    expect(questionsLeft(null, EMPTY_ANSWERS)).toEqual([]);
  });

  it('with a gift, asks the donor’s name, email and phone', () => {
    const gift = { ...answered, donation: true, donor: { name: 'Marie Ngo', email: 'marie@', phone: '690000000' } };
    expect(questionsLeft('proofOfFunds', gift)).toEqual(['donor']);
    expect(questionsLeft('proofOfFunds', { ...gift, donor: { ...gift.donor, email: 'marie@example.cm' } })).toEqual([]);
  });

  it('asks about a UBA account for the « sans fonds » service only', () => {
    expect(questionsLeft('proofOfFundsNoFunds', answered)).toEqual(['ubaAccount']);
    expect(questionsLeft('proofOfFundsNoFunds', { ...answered, ubaAccount: true })).toEqual([]);
  });

  it('asks the donor’s photo only with a gift', () => {
    const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds')!;
    expect(askedPrerequisites(pof.prerequisites, answered).map((item) => item.key)).toEqual([
      'photo',
      'signature',
      'plan-de-localisation',
      'bulletin-de-paie',
    ]);
    expect(askedPrerequisites(pof.prerequisites, { ...answered, donation: true }).at(-1)?.key).toBe('photo-donateur');
  });
});

describe('a service’s prerequisites', () => {
  it('reads those saved before keys and types as files, keyed by their name', () => {
    expect(prerequisitesOf([{ fr: 'Bulletin n° 3', en: 'Bulletin no. 3', kind: null }])).toEqual([
      { key: 'bulletin-n-3', fr: 'Bulletin n° 3', en: 'Bulletin no. 3', type: 'file', kind: null, when: null },
    ]);
    expect(prerequisitesOf(null)).toEqual([]);
    expect(prerequisiteKey('Carte nationale d’identité')).toBe('carte-nationale-d-identite');
  });
});
