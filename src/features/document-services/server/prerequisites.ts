import type { Prerequisite, Texts } from '@/features/document-services/lib/service-schema';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];
type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

/** `held`: the Dossier has it with a file; `listed`: it is there, waiting for one; `missing`: not in the Dossier. */
export type PrerequisiteState = 'held' | 'listed' | 'missing';

type DossierDocument = { kind: string | null; title: string; versions: number };

/** The Dossier's Document standing for this prerequisite: the same Checklist kind, else the same name. */
const matching = (prerequisite: Prerequisite, documents: DossierDocument[]) =>
  documents.find((document) =>
    prerequisite.kind
      ? document.kind === prerequisite.kind
      : [prerequisite.fr, prerequisite.en].some((name) => name.toLowerCase() === document.title.toLowerCase()),
  );

const documentsOf = async (db: Db | Tx, dossierId: string): Promise<DossierDocument[]> =>
  (
    await db.dossierDocument.findMany({
      where: { section: { dossierId } },
      select: { kind: true, title: true, _count: { select: { versions: true } } },
    })
  ).map((document) => ({ kind: document.kind, title: document.title, versions: document._count.versions }));

/** Where each of a service's prerequisites stands in a Dossier. */
export async function prerequisiteStates(db: Db, dossierId: string, prerequisites: Prerequisite[]): Promise<PrerequisiteState[]> {
  const documents = await documentsOf(db, dossierId);
  return prerequisites.map((prerequisite) => {
    const found = matching(prerequisite, documents);
    return !found ? 'missing' : found.versions > 0 ? 'held' : 'listed';
  });
}

/**
 * When Stanzy takes a service on, the prerequisites the Dossier doesn't have
 * yet become Documents to upload, in their own Section (« Pièces pour :
 * Certificat de police »), named in the Client's language. Those already
 * there (a passport…) are not added twice. Nothing when none is missing.
 */
export async function addPrerequisiteDocuments(
  tx: Tx,
  opts: { dossierId: string; serviceName: Texts; prerequisites: Prerequisite[]; locale: 'fr' | 'en'; addedById: string },
): Promise<number> {
  const documents = await documentsOf(tx, opts.dossierId);
  const missing = opts.prerequisites.filter((prerequisite) => !matching(prerequisite, documents));
  if (missing.length === 0) return 0;
  const last = await tx.dossierSection.findFirst({
    where: { dossierId: opts.dossierId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const titles = { fr: `Pièces pour : ${opts.serviceName.fr}`, en: `Documents for: ${opts.serviceName.en}` };
  const section = await tx.dossierSection.create({
    data: { dossierId: opts.dossierId, title: titles[opts.locale], titles, position: (last?.position ?? 0) + 1 },
    select: { id: true },
  });
  await tx.dossierDocument.createMany({
    data: missing.map((prerequisite) => ({
      sectionId: section.id,
      title: prerequisite[opts.locale],
      kind: prerequisite.kind,
      need: 'mandatory',
      missing: true,
      addedById: opts.addedById,
    })),
  });
  return missing.length;
}
