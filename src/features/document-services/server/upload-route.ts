import { NextResponse } from 'next/server';

import { requirementFilePrefix } from '@/features/document-services/lib/requirements';
import { editableRequest } from '@/features/document-services/server/requirements';
import { prepareEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends a file it encrypted for a Service documentaire's
 * prerequisite (#80): a fresh key under the request's folder in the private
 * R2 bucket. Body: `{ requestId }`. Whoever sees the request, while it is
 * under way. `documentServices.requirements.addFile` records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    const { requestId } = (await request.json()) as { requestId?: unknown };
    if (typeof requestId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
    const found = await editableRequest(prisma, session, requestId);
    return NextResponse.json(await prepareEncryptedUpload(requirementFilePrefix(found.request.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}
