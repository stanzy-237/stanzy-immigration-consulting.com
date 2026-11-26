'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { NextConsultationCard } from '@/features/consultation/components/space-parts';
import { PRESS } from '@/features/consultation/lib/styles';
import { NoConsultation } from '@/features/consultation/views/my-consultations-view';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/**
 * Mon espace's home, top (`Mon espace v2 · 1 Avant`, `6 Aucune consultation`):
 * the next Consultation, with « Préparer »; with no Consultation and no
 * Dossier yet, « Pas encore de consultation ».
 */
export function ConsultationHome(): ReactNode {
  const t = useTranslations('Consultation.space');
  const trpc = useTRPC();
  const { data } = useQuery(trpc.consultationSpace.list.queryOptions());
  const dossiers = useQuery(trpc.dossiers.mine.queryOptions());
  if (!data || !dossiers.data) return null;
  const hasDossiers = dossiers.data.length > 0;
  const next = data.upcoming.find((c) => c.status === 'PAID');
  if (next) {
    return (
      <NextConsultationCard
        consultation={next}
        action={
          <Link href={`/mon-espace/consultations/${next.id}`} className={cn('flex h-13 items-center justify-center rounded-full border border-white/30 px-6 font-heading text-body font-bold text-white hover:bg-white/10', PRESS)}>
            {t('prepare')}
          </Link>
        }
      />
    );
  }
  if (data.upcoming.length === 0 && data.past.length === 0 && !hasDossiers) return <NoConsultation />;
  return null;
}
