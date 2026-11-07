import { describe, expect, it } from 'vitest';

import { checkHistory, familyMissing, type Member } from '@/features/client-forms/lib/form-schema';

const today = new Date('2026-11-07T10:00:00Z');
const person = (extra: Partial<Member>): Member => ({
  id: 'p',
  relation: 'applicant',
  name: 'Aminata Diallo',
  birthDate: '1994-04-02',
  birthCountry: 'Cameroun',
  maritalStatus: 'single',
  address: 'Douala',
  occupation: 'Comptable',
  deceased: false,
  deathDate: null,
  deathPlace: '',
  accompanying: true,
  ...extra,
});

describe('the personal history', () => {
  it('is complete once activities and addresses cover the window, the birth date given', () => {
    const covered = { from: '2010-01', to: null };
    const activity = { ...covered, id: 'a', kind: 'work' as const, title: 'Comptable', city: 'Douala', country: 'Cameroun', status: 'Citoyenne' };
    const address = { ...covered, id: 'b', line: 'Rue 1', city: 'Douala', province: 'Littoral', postalCode: '', country: 'Cameroun' };
    expect(checkHistory({ birthDate: '1994-04-02', activities: [activity], addresses: [address] }, today).complete).toBe(true);

    const check = checkHistory({ birthDate: null, activities: [activity], addresses: [] }, today);
    expect(check.complete).toBe(false);
    expect(check.addressGaps).toEqual([{ from: '2016-12', to: '2026-11' }]);
  });
});

describe('the family', () => {
  it('needs the applicant and both parents, each named with a birth date', () => {
    expect(familyMissing({ members: [person({})] })).toEqual(['mother', 'father']);
    expect(
      familyMissing({
        members: [person({}), person({ id: 'm', relation: 'mother' }), person({ id: 'f', relation: 'father', birthDate: null })],
      }),
    ).toEqual(['details']);
  });
});
