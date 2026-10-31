/**
 * Who reaches which Dossier, shared by the documents router and the file
 * routes: the consultant every one, a Client their own.
 */
import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';

const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

type Db = TRPCContext['prisma'];

const dossierFields = {
  id: true,
  service: true,
  stage: true,
  state: true,
  accountId: true,
  account: { select: { id: true, name: true, email: true, locale: true } },
} as const;

export type DossierRow = Prisma.DossierGetPayload<{ select: typeof dossierFields }>;

export const isConsultant = (session: CurrentSession): boolean => session.account.role === 'CONSULTANT';

/** The consultant reaches every Dossier, a Client only their own; anyone else gets NOT_FOUND, as if it didn't exist. */
function reachable<T extends DossierRow>(session: CurrentSession, dossier: T | null): T {
  if (!dossier || (!isConsultant(session) && dossier.accountId !== session.account.id)) throw notFound();
  return dossier;
}

/** A closed Dossier reads, but nothing in it changes. */
export function writable(dossier: DossierRow): void {
  if (dossier.state !== 'OPEN') throw refuse('DOSSIER_CLOSED');
}

export async function dossierFor(prisma: Db, session: CurrentSession, id: string): Promise<DossierRow> {
  return reachable(session, await prisma.dossier.findUnique({ where: { id }, select: dossierFields }));
}

export async function sectionFor(prisma: Db, session: CurrentSession, id: string) {
  const section = await prisma.dossierSection.findUnique({
    where: { id },
    select: { id: true, dossier: { select: dossierFields } },
  });
  if (!section) throw notFound();
  return { ...section, dossier: reachable(session, section.dossier) };
}

export async function documentFor(prisma: Db, session: CurrentSession, id: string) {
  const document = await prisma.dossierDocument.findUnique({
    where: { id },
    select: { id: true, title: true, section: { select: { dossier: { select: dossierFields } } } },
  });
  if (!document) throw notFound();
  return { id: document.id, title: document.title, dossier: reachable(session, document.section.dossier) };
}
