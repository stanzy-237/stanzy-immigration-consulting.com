import { NextResponse } from 'next/server';

import { storedKey } from '@/features/meetings/server/meeting-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { presignDownload } from '@/server/storage/r2';

/**
 * A Consultation's Enregistrement for its Client (#15, `Mon espace v2 · 3
 * Après · Récap`): only theirs, only once published, through a 5-minute
 * address to watch in the page (never offered for download).
 */
export async function GET(request: Request, { params }: { params: Promise<{ consultationId: string }> }): Promise<Response> {
  const { consultationId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 404 });
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    select: { accountId: true, publishedAt: true, meetingId: true },
  });
  if (!consultation || consultation.accountId !== session.account.id || !consultation.publishedAt || !consultation.meetingId) {
    return new NextResponse(null, { status: 404 });
  }
  const recording = await prisma.meetingRecording.findFirst({
    where: { meetingId: consultation.meetingId, kind: 'RECORDING' },
    orderBy: { startedAt: 'asc' },
    select: { id: true, filename: true, url: true, objectKey: true },
  });
  if (!recording) return new NextResponse(null, { status: 404 });
  let key = recording.objectKey;
  if (!key) {
    key = await storedKey(consultation.meetingId, recording.filename);
    if (key) await prisma.meetingRecording.update({ where: { id: recording.id }, data: { objectKey: key } });
  }
  const location = key ? await presignDownload('private', key) : recording.url;
  return NextResponse.redirect(location, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
}
