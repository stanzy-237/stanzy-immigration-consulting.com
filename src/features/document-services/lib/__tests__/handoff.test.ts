import { describe, expect, it } from 'vitest';

import {
  fillNote,
  handoffValues,
  unknownPlaceholders,
  type NoteDoc,
} from '@/features/document-services/lib/handoff';
import { EMPTY_ANSWERS } from '@/features/document-services/lib/requirements';

const doc = (...texts: string[]): NoteDoc => ({
  type: 'doc',
  content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

describe('the partner note’s placeholders (#148)', () => {
  const values = handoffValues({
    client: { name: 'Aminata Diallo', email: 'aminata@example.com' },
    service: 'Preuve de fonds',
    today: '2026-11-15',
    interest: {
      progress: { citizenship: 'Camerounaise' },
      work: {
        phone: '+237 692 24 53 94',
        experiences: [
          { title: 'Caissière', company: 'Super U', cnp: '65100', startOn: '2014-02-01', endOn: '2018-12-31' },
          { title: 'Comptable', company: 'Brasseries du Cameroun', cnp: '11100', startOn: '2019-03-01', endOn: null },
        ],
      },
    },
    request: {
      ...EMPTY_ANSWERS,
      niu: 'M012345678901A',
      salaryAccount: true,
      salaryAccounts: [{ company: 'Brasseries du Cameroun', startOn: '2020-01-01', endOn: null }],
    },
  });

  it('fills each one from the Client’s details: the current job, the first one’s start, the salary accounts', () => {
    expect(values).toEqual({
      client: 'Aminata Diallo',
      email: 'aminata@example.com',
      telephone: '+237 692 24 53 94',
      nationalite: 'Camerounaise',
      service: 'Preuve de fonds',
      date: '15/11/2026',
      niu: 'M012345678901A',
      entreprise: 'Brasseries du Cameroun',
      poste: 'Comptable',
      cnp: '11100',
      date_premier_emploi: '01/02/2014',
      comptes_salaire: 'Brasseries du Cameroun (01/01/2020 – …)',
    });
  });

  it('leaves blank what the Client never said', () => {
    const bare = handoffValues({
      client: { name: 'Bob', email: 'bob@example.com' },
      service: 'CNPS',
      today: '2026-11-15',
      interest: null,
      request: EMPTY_ANSWERS,
    });
    expect(bare).toMatchObject({ client: 'Bob', telephone: '', entreprise: '', date_premier_emploi: '', comptes_salaire: '' });
  });

  it('replaces them in the note’s text, keeping the formatting, an unknown one as written', () => {
    const bold = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Client : ' },
            { type: 'text', text: '{client}', marks: [{ type: 'bold' }] },
            { type: 'text', text: ', employé depuis le {date_premier_emploi} chez {entreprise}. {inconnu}' },
          ],
        },
      ],
    };
    expect(fillNote(bold, values).content![0]!.content).toEqual([
      { type: 'text', text: 'Client : ' },
      { type: 'text', text: 'Aminata Diallo', marks: [{ type: 'bold' }] },
      { type: 'text', text: ', employé depuis le 01/02/2014 chez Brasseries du Cameroun. {inconnu}' },
    ]);
    expect(unknownPlaceholders(bold)).toEqual(['inconnu']);
    expect(unknownPlaceholders(doc('{client} {niu}'))).toEqual([]);
  });
});
