'use client';

import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { DossierMeetings, DossierMeetingsSkeleton } from '@/features/meetings/components/dossier-meetings';

/**
 * A Dossier's Réunions, for a Dossier page to show: the route passes it to
 * the dossiers view as its `meetings` slot, so neither feature imports the
 * other's UI.
 */
export function DossierMeetingsView({ dossierId, viewer }: { dossierId: string; viewer: 'consultant' | 'client' }): ReactNode {
  return (
    <QueryBoundary fallback={<DossierMeetingsSkeleton />}>
      <DossierMeetings dossierId={dossierId} viewer={viewer} />
    </QueryBoundary>
  );
}
