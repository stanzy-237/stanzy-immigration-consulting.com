import { NextResponse } from 'next/server';

import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { storedKey } from '@/features/meetings/server/meeting-files';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { presignDownload } from '@/server/storage/r2';

/**
 * A Réunion's Enregistrement (or its Transcription's file), for the
 * consultant only (#94): straight from our private bucket through a
 * 5-minute address, or from Stream while it still keeps its copy.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return new NextResponse(null, { status: 404 });
  const recording = await prisma.meetingRecording.findUnique({
    where: { id },
    select: { id: true, meetingId: true, filename: true, url: true, objectKey: true },
  });
  if (!recording) return new NextResponse(null, { status: 404 });

  let key = recording.objectKey;
  if (!key) {
    // Stream may have finished copying it to the bucket after its webhook.
    key = await storedKey(recording.meetingId, recording.filename);
    if (key) await prisma.meetingRecording.update({ where: { id: recording.id }, data: { objectKey: key } });
  }
  const location = key ? await presignDownload('private', key) : recording.url;
  return NextResponse.redirect(location, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
}
