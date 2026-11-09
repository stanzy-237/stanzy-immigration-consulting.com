/**
 * What a Client hands over for a Service documentaire (#80): the request's
 * questionnaire and files. They belong to the request, not to the Dossier:
 * nothing handed over here becomes a Dossier Document or a Finale. The link
 * runs one way only: a Checklist document already in the Dossier (a passport
 * with a Version) also covers the prerequisite of its kind.
 */
import { TRPCError } from '@trpc/server';

import { answersOf, askedPrerequisites, questionsLeft } from '@/features/document-services/lib/requirements';
import { prerequisitesOf, type Questionnaire } from '@/features/document-services/lib/service-schema';
import { dossierFor, isConsultant, type DossierRow } from '@/features/dossiers/server/dossier-access';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** A Stanzy request still under way: what is handed over for it can change. */
export const OPEN_STANZY = ['REQUESTED', 'ACCEPTED', 'ASSIGNED'] as const;

/** `given`: handed over for the request; `inDossier`: covered by the Dossier's Checklist document; `missing`. */
export type RequirementState = 'given' | 'inDossier' | 'missing';

/** What a request carries for its hand-over, read alone or in a list. */
export const REQUEST_FIELDS = {
  id: true,
  status: true,
  answers: true,
  startedOn: true,
  createdAt: true,
  submittedAt: true,
  confirmedAt: true,
  document: { select: { id: true, title: true, section: { select: { dossierId: true } } } },
  service: { select: { slug: true, name: true, prerequisites: true, questionnaire: true, turnaroundDays: true } },
} as const;

/**
 * The request and its Dossier, for whoever may see what is handed over for
 * it: the Dossier's Client and the consultant (the Partner in charge of the
 * service joins here with #42). Anyone else gets NOT_FOUND. `editable` while
 * the request is under way in an open Dossier, and for the Client only until
 * the consultant confirmed what was handed over.
 */
export async function requestFor(db: Db, session: CurrentSession, requestId: string) {
  const request = await db.stanzyRequest.findUnique({ where: { id: requestId }, select: REQUEST_FIELDS });
  if (!request) throw new TRPCError({ code: 'NOT_FOUND' });
  const dossier: DossierRow = await dossierFor(db, session, request.document.section.dossierId);
  const underWay = dossier.state === 'OPEN' && (OPEN_STANZY as readonly string[]).includes(request.status);
  const editable = underWay && (isConsultant(session) || !request.confirmedAt);
  return { request, dossier, editable };
}

/** For a change: the request, under way in an open Dossier (BAD_REQUEST REQUIREMENTS_CLOSED otherwise). */
export async function editableRequest(db: Db, session: CurrentSession, requestId: string) {
  const found = await requestFor(db, session, requestId);
  if (!found.editable) throw new TRPCError({ code: 'BAD_REQUEST', message: 'REQUIREMENTS_CLOSED' });
  return found;
}

type RequestRow = Pick<Awaited<ReturnType<typeof requestFor>>['request'], 'id' | 'answers' | 'service'>;
type FileRow = { id: string; key: string; fileName: string; contentType: string; size: number; createdAt: Date };
type CoveringDocument = { id: string; kind: string | null; title: string };

/** The Checklist kinds a request's asked prerequisites could be covered by. */
export function coverableKinds(request: RequestRow): string[] {
  const asked = askedPrerequisites(prerequisitesOf(request.service?.prerequisites), answersOf(request.answers));
  return asked.flatMap((item) => (item.kind ? [item.kind] : []));
}

/**
 * Everything handed over for a request and what is still missing, from its
 * files and its Dossier's Documents with a Version (`covered`): pure, so a
 * list of requests reads its rows once.
 */
export function summarize(request: RequestRow, files: FileRow[], covered: CoveringDocument[]) {
  const prerequisites = prerequisitesOf(request.service?.prerequisites);
  const questionnaire = (request.service?.questionnaire ?? null) as Questionnaire | null;
  const answers = answersOf(request.answers);
  const items = askedPrerequisites(prerequisites, answers).map((item) => {
    const own = files.filter((file) => file.key === item.key);
    const document = item.kind ? (covered.find((candidate) => candidate.kind === item.kind) ?? null) : null;
    const state: RequirementState = own.length > 0 ? 'given' : document ? 'inDossier' : 'missing';
    return { ...item, files: own, document, state };
  });
  const left = questionsLeft(questionnaire, answers);
  return {
    items,
    questionnaire,
    answers,
    questionsLeft: left,
    complete: left.length === 0 && items.every((item) => item.state !== 'missing'),
  };
}

export const FILE_FIELDS = { id: true, key: true, fileName: true, contentType: true, size: true, createdAt: true } as const;

/** Everything handed over for a request, and what is still missing. */
export async function requirementsOf(db: Db, found: Awaited<ReturnType<typeof requestFor>>) {
  const { request, dossier } = found;
  const kinds = coverableKinds(request);
  const [files, covered] = await Promise.all([
    db.requirementFile.findMany({ where: { requestId: request.id }, orderBy: { createdAt: 'asc' }, select: FILE_FIELDS }),
    kinds.length > 0
      ? db.dossierDocument.findMany({
          where: { section: { dossierId: dossier.id }, kind: { in: kinds }, versions: { some: {} } },
          select: { id: true, kind: true, title: true },
        })
      : Promise.resolve([]),
  ]);
  return summarize(request, files, covered);
}

/**
 * After the Client changed what was handed over: if something is missing
 * again since « Suivant », back to step ① (the documents to receive hide).
 */
export async function reopenIfIncomplete(db: Db, session: CurrentSession, requestId: string): Promise<void> {
  const found = await requestFor(db, session, requestId);
  if (!found.request.submittedAt || found.request.confirmedAt) return;
  if ((await requirementsOf(db, found)).complete) return;
  await db.stanzyRequest.update({ where: { id: requestId }, data: { submittedAt: null } });
}
