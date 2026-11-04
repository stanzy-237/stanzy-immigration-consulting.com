'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';
import { useTRPC } from '@/trpc/client';

const KNOWN = [
  'CONTRACT_TEMPLATE_MISSING',
  'SIGNATURE_ASSETS_MISSING',
  'CONTRACT_ALREADY_SENT',
  'CONTRACT_ALREADY_SIGNED',
  'CONTRACT_NOT_SIGNED',
  'AMENDMENT_ALREADY_SENT',
  'CONTRACT_NOT_PENDING',
  'CONTRACT_NOT_YOURS',
  'SIGNATURE_DOCUMENT_CHANGED',
  'SIGNATURE_IMAGE_INVALID',
  'DOSSIER_CLOSED',
  'DOSSIER_FILES_UNCONFIGURED',
];

/** Toasts why a Contrat action was refused, and re-reads the Contrats when the screen was out of date. */
export function useContractErrors(): (error: { message: string }) => void {
  const t = useTranslations('Contracts.errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return (error) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    if (reason !== 'UNKNOWN') void queryClient.invalidateQueries({ queryKey: trpc.contracts.pathKey() });
    toast.add({ title: t(reason as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
}
