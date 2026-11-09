'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { MeetingCardsSkeleton, MeetingsNav, type MeetingPage } from '@/features/meetings/components/meeting-parts';

/**
 * A Réunions tab while it loads: its title and tabs drawn at once, the tab
 * clicked already selected, and cards to come below.
 */
export function MeetingsLoadingView({ page }: { page: MeetingPage }): ReactNode {
  const t = useTranslations('Meetings.hub');
  const title = page === 'upcoming' || page === 'past' ? t(`list.${page}`) : t(`nav.${page}`);
  return (
    <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6">
      <MeetingsNav page={page} title={title} />
      <div className="animate-skeleton-in">
        <MeetingCardsSkeleton />
      </div>
    </div>
  );
}
