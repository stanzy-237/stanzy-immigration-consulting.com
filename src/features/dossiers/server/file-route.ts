import { NextResponse } from 'next/server';

import { documentFor } from '@/features/dossiers/server/dossier-access';
import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/** A Version's file, decrypted on the server for its Client or the consultant (ADR 0007). */
export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }): Promise<Response> {
  const { versionId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { documentId: true, fileName: true, contentType: true, objectKey: true, wrappedKey: true, iv: true },
  });
  if (!version) return new NextResponse(null, { status: 404 });
  try {
    await documentFor(prisma, session, version.documentId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return serveEncryptedFile(request, version);
}
