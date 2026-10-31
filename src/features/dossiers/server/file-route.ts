import { NextResponse } from 'next/server';

import { documentFor } from '@/features/dossiers/server/dossier-access';
import { openVersionFile } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * A Version's file, decrypted on the server for its Client or the consultant
 * (ADR 0007). Never cached; shown in the browser, since every allowed type
 * (PDF, images) is safe to display inline.
 */
export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }): Promise<Response> {
  const { versionId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { documentId: true, fileName: true, contentType: true, blobUrl: true, wrappedKey: true, iv: true },
  });
  if (!version) return new NextResponse(null, { status: 404 });
  try {
    await documentFor(prisma, session, version.documentId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const file = await openVersionFile(version);
    const download = new URL(request.url).searchParams.has('download');
    return new Response(file, {
      headers: {
        'Content-Type': version.contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(version.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[dossiers] could not open a Version', error);
    return new NextResponse(null, { status: 502 });
  }
}
