import { describe, expect, it } from 'vitest';

import {
  editedComment,
  inLanguage,
  renamedSection,
  threadsOf,
  withComment,
  withDocument,
  withFinal,
  withoutComment,
  withSection,
  type SectionsData,
} from '@/features/dossiers/lib/documents-cache';
import { isOptimistic } from '@/lib/optimistic-list';

const at = new Date('2026-11-01T10:00:00Z');
const comment = (id: string, parentId: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  parentId,
  body: `message ${id}`,
  createdAt: at,
  editedAt: null,
  deletedAt: null,
  author: { id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' as const },
  ...extra,
});

const data = (comments: ReturnType<typeof comment>[] = []): SectionsData => ({
  viewer: { id: 'acc_1', name: 'Aminata Diallo', role: 'MEMBER' },
  open: true,
  locked: false,
  stanzy: false,
  sections: [
    {
      id: 'sec_1',
      title: 'Diplômes',
      titles: null,
      documents: [
        {
          id: 'doc_1',
          title: 'Licence',
          titles: null,
          createdAt: at,
          finalVersionId: null,
          addedBy: { name: 'Stanzy', role: 'CONSULTANT' },
          versions: [],
          comments,
          signatures: [],
          kind: null,
          need: null,
          missing: false,
          clientNote: null,
          clientForm: null,
          stanzyRequests: [],
        },
      ],
    },
  ],
});
const comments = (state: SectionsData) => state.sections[0]!.documents[0]!.comments;

describe('what shows before the server answers', () => {
  it('adds Sections and Documents under the viewer’s name, marked as not confirmed yet', () => {
    const next = withDocument(withSection(data(), { title: ' Preuve de fonds ' }), {
      sectionId: 'sec_1',
      title: 'Relevé',
    });
    expect(next.sections[1]).toMatchObject({ title: 'Preuve de fonds', documents: [] });
    expect(isOptimistic(next.sections[1]!)).toBe(true);
    expect(next.sections[0]!.documents[1]).toMatchObject({ title: 'Relevé', addedBy: { name: 'Aminata Diallo' } });
  });

  it('moves the Finale', () => {
    expect(
      withFinal(data(), { documentId: 'doc_1', versionId: 'ver_2' }).sections[0]!.documents[0]!.finalVersionId,
    ).toBe('ver_2');
  });

  it('puts a reply to a reply under its comment, as the viewer', () => {
    const next = withComment(data([comment('c1', null), comment('r1', 'c1')]), {
      documentId: 'doc_1',
      parentId: 'r1',
      body: 'Merci !',
    });
    expect(comments(next).at(-1)).toMatchObject({ parentId: 'c1', body: 'Merci !', author: { id: 'acc_1' } });
  });

  it('marks an edit', () => {
    expect(comments(editedComment(data([comment('c1', null)]), { id: 'c1', body: 'Corrigé' }))[0]).toMatchObject({
      body: 'Corrigé',
      editedAt: expect.any(Date),
    });
  });
});

describe('deleting a message', () => {
  it('keeps a message with replies as « supprimé », without its words', () => {
    const next = withoutComment(data([comment('c1', null), comment('r1', 'c1')]), { id: 'c1' });
    expect(comments(next)[0]).toMatchObject({ id: 'c1', body: '', deletedAt: expect.any(Date) });
    expect(comments(next)).toHaveLength(2);
  });

  it('removes a deleted message once its last reply goes', () => {
    const next = withoutComment(data([comment('c1', null, { deletedAt: at, body: '' }), comment('r1', 'c1')]), {
      id: 'r1',
    });
    expect(comments(next)).toEqual([]);
  });
});

describe('threads', () => {
  it('lists each message with its replies, oldest first', () => {
    const threads = threadsOf([comment('c1', null), comment('c2', null), comment('r1', 'c1'), comment('r2', 'c1')]);
    expect(threads.map(({ comment: c, replies }) => [c.id, replies.map((r) => r.id)])).toEqual([
      ['c1', ['r1', 'r2']],
      ['c2', []],
    ]);
  });
});

describe('the names in the viewer’s language', () => {
  it('reads a Section and a Document made from the Checklist in English, and keeps a name the consultant gave', () => {
    const base = data();
    const section = base.sections[0]!;
    const state: SectionsData = {
      ...base,
      sections: [
        {
          ...section,
          titles: { fr: 'Diplômes – Requérant principal', en: 'Diplomas – Principal applicant' },
          documents: [
            { ...section.documents[0]!, titles: { fr: 'Diplôme', en: 'Diploma' } },
            { ...section.documents[0]!, id: 'doc_2', title: 'Attestation maison' },
          ],
        },
      ],
    };
    const english = inLanguage('en')(state).sections[0]!;
    expect(english.title).toBe('Diplomas – Principal applicant');
    expect(english.documents.map((document) => document.title)).toEqual(['Diploma', 'Attestation maison']);
    expect(inLanguage('fr')(state).sections[0]!.documents[0]!.title).toBe('Diplôme');
  });

  it('clears a Section’s names when the consultant renames it', () => {
    const state: SectionsData = { ...data(), sections: [{ ...data().sections[0]!, titles: { fr: 'A', en: 'B' } }] };
    const renamed = renamedSection(state, { id: 'sec_1', title: 'Preuve de fonds' });
    expect(inLanguage('en')(renamed).sections[0]!.title).toBe('Preuve de fonds');
  });
});
