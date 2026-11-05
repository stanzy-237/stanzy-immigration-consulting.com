'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import type { DossierTab } from '@/features/dossiers/components/dossier-tabs';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { isPast } from '@/features/meetings/lib/meeting-schema';
import { useTRPC } from '@/trpc/client';

/**
 * What waits in each of a Dossier's tabs, from the queries its route
 * prefetched: missing Documents, messages, coming Réunions, invoices to pay.
 */
export function useDossierCounts(dossierId: string): Partial<Record<DossierTab, { value: number; label: string }>> {
  const t = useTranslations('Dossiers.tabs.counts');
  const trpc = useTRPC();
  const ref = { dossierId };
  const { data: documents } = useQuery(trpc.dossiers.documents.sections.queryOptions(ref));
  const { data: messages } = useQuery(trpc.dossiers.messages.list.queryOptions(ref));
  const { data: meetings } = useQuery(trpc.meetings.forDossier.queryOptions(ref));
  const { data: invoices } = useQuery(trpc.invoices.forDossier.queryOptions(ref));
  const now = new Date();

  const missing =
    documents?.sections
      .flatMap((section) => section.documents)
      .filter((document) => document.missing && document.versions.length === 0).length ?? 0;
  const said = messages?.messages.filter((message) => !message.deletedAt).length ?? 0;
  const coming =
    meetings?.meetings.filter((meeting) => meeting.status === 'SCHEDULED' && !isPast(meeting, now)).length ?? 0;
  const toPay = invoices?.filter((invoice) => isAwaitingPayment(invoice.status)).length ?? 0;

  return {
    documents: { value: missing, label: t('documents', { count: missing }) },
    messages: { value: said, label: t('messages', { count: said }) },
    reunions: { value: coming, label: t('reunions', { count: coming }) },
    facturation: { value: toPay, label: t('facturation', { count: toPay }) },
  };
}
