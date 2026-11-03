import { optimisticId } from '@/lib/optimistic-list';
import type { RouterOutputs } from '@/trpc/types';

/**
 * How each change to a Dossier's documents reads on screen before the server
 * answers: the same rules as `dossiers.documents`, applied to the cached
 * `sections` query. The refetch that follows replaces the guesses.
 */
export type SectionsData = RouterOutputs['dossiers']['documents']['sections'];
type Section = SectionsData['sections'][number];
type Document = Section['documents'][number];
type Comment = Document['comments'][number];

const mapDocuments = (data: SectionsData, change: (document: Document) => Document): SectionsData => ({
  ...data,
  sections: data.sections.map((section) => ({ ...section, documents: section.documents.map(change) })),
});

const mapDocument = (data: SectionsData, documentId: string, change: (document: Document) => Document) =>
  mapDocuments(data, (document) => (document.id === documentId ? change(document) : document));

export const withSection = (data: SectionsData, input: { title: string }): SectionsData => ({
  ...data,
  sections: [...data.sections, { id: optimisticId(), title: input.title.trim(), documents: [] }],
});

export const renamedSection = (data: SectionsData, input: { id: string; title: string }): SectionsData => ({
  ...data,
  sections: data.sections.map((section) =>
    section.id === input.id ? { ...section, title: input.title.trim() } : section,
  ),
});

export const withoutSection = (data: SectionsData, input: { id: string }): SectionsData => ({
  ...data,
  sections: data.sections.filter((section) => section.id !== input.id),
});

export const withDocument = (data: SectionsData, input: { sectionId: string; title: string }): SectionsData => ({
  ...data,
  sections: data.sections.map((section) =>
    section.id === input.sectionId
      ? {
          ...section,
          documents: [
            ...section.documents,
            {
              id: optimisticId(),
              title: input.title.trim(),
              createdAt: new Date(),
              finalVersionId: null,
              addedBy: { name: data.viewer.name, role: data.viewer.role },
              versions: [],
              comments: [],
              signatures: [],
            },
          ],
        }
      : section,
  ),
});

export const withoutDocument = (data: SectionsData, input: { id: string }): SectionsData => ({
  ...data,
  sections: data.sections.map((section) => ({
    ...section,
    documents: section.documents.filter((document) => document.id !== input.id),
  })),
});

export const withFinal = (data: SectionsData, input: { documentId: string; versionId: string | null }) =>
  mapDocument(data, input.documentId, (document) => ({ ...document, finalVersionId: input.versionId }));

/** A new comment, or a reply under its comment (a reply to a reply joins the same comment). */
export const withComment = (
  data: SectionsData,
  input: { documentId: string; parentId?: string; body: string },
): SectionsData =>
  mapDocument(data, input.documentId, (document) => {
    const parent = input.parentId ? document.comments.find((comment) => comment.id === input.parentId) : undefined;
    const comment: Comment = {
      id: optimisticId(),
      parentId: parent ? (parent.parentId ?? parent.id) : null,
      body: input.body.trim(),
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
      author: data.viewer,
    };
    return { ...document, comments: [...document.comments, comment] };
  });

export const editedComment = (data: SectionsData, input: { id: string; body: string }): SectionsData =>
  mapDocuments(data, (document) => ({
    ...document,
    comments: document.comments.map((comment) =>
      comment.id === input.id ? { ...comment, body: input.body.trim(), editedAt: new Date() } : comment,
    ),
  }));

/**
 * A comment with replies stays as « Commentaire supprimé »; one without goes,
 * and takes with it a deleted comment it was the last reply to.
 */
export const withoutComment = (data: SectionsData, input: { id: string }): SectionsData =>
  mapDocuments(data, (document) => {
    const target = document.comments.find((comment) => comment.id === input.id);
    if (!target) return document;
    if (document.comments.some((comment) => comment.parentId === target.id)) {
      return {
        ...document,
        comments: document.comments.map((comment) =>
          comment.id === target.id ? { ...comment, body: '', deletedAt: new Date() } : comment,
        ),
      };
    }
    const left = document.comments.filter((comment) => comment.id !== target.id);
    const parent = left.find((comment) => comment.id === target.parentId);
    const orphaned = parent?.deletedAt && !left.some((comment) => comment.parentId === parent.id);
    return { ...document, comments: orphaned ? left.filter((comment) => comment.id !== parent.id) : left };
  });

/** A conversation as threads: each comment, then its replies, oldest first. */
export function threadsOf(comments: Comment[]): { comment: Comment; replies: Comment[] }[] {
  return comments
    .filter((comment) => comment.parentId === null)
    .map((comment) => ({ comment, replies: comments.filter((reply) => reply.parentId === comment.id) }));
}
