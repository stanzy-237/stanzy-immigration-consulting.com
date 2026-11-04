import { NextResponse } from 'next/server';

import { messageFilePrefix } from '@/features/dossiers/lib/message-schema';
import { dossierFor, writable } from '@/features/dossiers/server/dossier-access';
import { prepareEncryptedUpload, serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends a file it encrypted for a Dossier message (ADR
 * 0007): a fresh key under the Dossier's messages folder. Body:
 * `{ dossierId }`; its Client or the consultant, while the Dossier is open.
 * `dossiers.messages.post` checks the file and records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    const { dossierId } = (await request.json()) as { dossierId?: unknown };
    if (typeof dossierId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
    const dossier = await dossierFor(prisma, session, dossierId);
    writable(dossier);
    return NextResponse.json(await prepareEncryptedUpload(messageFilePrefix(dossier.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}

/** A message's file, decrypted for the Dossier's Client or the consultant. */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }): Promise<Response> {
  const { fileId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });
  const file = await prisma.dossierMessageFile.findUnique({
    where: { id: fileId },
    select: {
      fileName: true,
      contentType: true,
      objectKey: true,
      wrappedKey: true,
      iv: true,
      message: { select: { dossierId: true } },
    },
  });
  if (!file) return new NextResponse(null, { status: 404 });
  try {
    await dossierFor(prisma, session, file.message.dossierId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return serveEncryptedFile(request, file);
}
