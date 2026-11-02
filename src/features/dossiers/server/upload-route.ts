import { NextResponse } from 'next/server';

import { dossierFilePrefix } from '@/features/dossiers/lib/document-schema';
import { documentFor, writable } from '@/features/dossiers/server/dossier-access';
import { prepareEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends a Version it encrypted: a fresh key in the
 * private R2 bucket under the Dossier's folder, and a short-lived address to
 * PUT it to (ADR 0007, #87). Body: `{ documentId }`. Only its Client or the
 * consultant, while the Dossier is open. `dossiers.documents.addVersion`
 * records the file and checks it again.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    const { documentId } = (await request.json()) as { documentId?: unknown };
    if (typeof documentId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
    const { dossier } = await documentFor(prisma, session, documentId);
    writable(dossier);
    return NextResponse.json(await prepareEncryptedUpload(dossierFilePrefix(dossier.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}

/** The JSON a refused upload request answers with: 503 when files can't be stored on this deploy. */
export function uploadRefused(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : '';
  if (message === 'DOSSIER_FILES_UNCONFIGURED' || message === 'STORAGE_UNCONFIGURED') {
    return NextResponse.json({ error: 'DOSSIER_FILES_UNCONFIGURED' }, { status: 503 });
  }
  return NextResponse.json({ error: 'DOCUMENT_FILE_REJECTED' }, { status: 403 });
}
