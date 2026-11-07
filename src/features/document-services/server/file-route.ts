import { NextResponse } from 'next/server';

import { requestFor } from '@/features/document-services/server/requirements';
import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/** A file handed over for a Service documentaire, decrypted for whoever sees its request (`?download` to save it). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 404 });
  const file = await prisma.requirementFile.findUnique({
    where: { id },
    select: { requestId: true, fileName: true, contentType: true, objectKey: true, wrappedKey: true, iv: true },
  });
  if (!file) return new NextResponse(null, { status: 404 });
  try {
    await requestFor(prisma, session, file.requestId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return serveEncryptedFile(request, file);
}
