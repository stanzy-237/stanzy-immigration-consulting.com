import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { dossierBlobPrefix } from '@/features/dossiers/lib/document-schema';
import { documentFor, writable } from '@/features/dossiers/server/dossier-access';
import { ENCRYPTED_FILE_MAX_BYTES, masterKey } from '@/features/dossiers/server/dossier-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Hands the browser a one-time token to send an already encrypted Version
 * straight to Vercel Blob (ADR 0007). The client payload names the Document;
 * only its Client or the consultant, while the Dossier is open, and only
 * under that Dossier's folder. The Version is recorded afterwards by
 * `dossiers.documents.addVersion`, which checks the file again.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        masterKey();
        const session = await getCurrentSession(request.headers);
        if (!session) throw new Error('FORBIDDEN');
        const { documentId } = JSON.parse(clientPayload ?? '{}') as { documentId?: unknown };
        if (typeof documentId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
        const { dossier } = await documentFor(prisma, session, documentId);
        writable(dossier);
        if (!pathname.startsWith(dossierBlobPrefix(dossier.id))) throw new Error('DOCUMENT_FILE_INVALID');
        return {
          allowedContentTypes: ['application/octet-stream'],
          maximumSizeInBytes: ENCRYPTED_FILE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'DOSSIER_FILES_UNCONFIGURED') return NextResponse.json({ error: message }, { status: 503 });
    return NextResponse.json({ error: 'DOCUMENT_FILE_REJECTED' }, { status: 403 });
  }
}
