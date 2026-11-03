import { NextResponse } from 'next/server';

import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/** A PDF of the Outils PDF history, decrypted for the consultant who made it (`?download` to save it). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return new NextResponse(null, { status: 404 });
  const file = await prisma.pdfToolFile.findFirst({
    where: { id, createdById: session.account.id },
    select: { name: true, objectKey: true, wrappedKey: true, iv: true },
  });
  if (!file) return new NextResponse(null, { status: 404 });
  return serveEncryptedFile(request, { ...file, fileName: file.name, contentType: 'application/pdf' });
}
