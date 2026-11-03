'use client';

import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';
import { useTRPC } from '@/trpc/client';
import { useQueryClient } from '@tanstack/react-query';

const KNOWN = [
  'SIGNATURE_PDF_ONLY',
  'SIGNATURE_PDF_UNREADABLE',
  'SIGNATURE_FIELD_OUTSIDE',
  'SIGNATURE_FIELD_MISSING',
  'SIGNATURE_ALREADY_PENDING',
  'SIGNATURE_ASSETS_MISSING',
  'SIGNATURE_NOT_PENDING',
  'SIGNATURE_NOT_YOURS',
  'SIGNATURE_DOCUMENT_CHANGED',
  'SIGNATURE_IMAGE_INVALID',
  'DOSSIER_CLOSED',
  'DOSSIER_FILES_UNCONFIGURED',
];

/**
 * Toasts why a Demande de signature was refused, in the reader's language,
 * and re-reads the Demandes when the screen was out of date (already
 * signed, cancelled, the Dossier closed).
 */
export function useSignatureErrors(): (error: { message: string }) => void {
  const t = useTranslations('Signatures.errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return (error) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    if (['SIGNATURE_NOT_PENDING', 'SIGNATURE_ALREADY_PENDING', 'DOSSIER_CLOSED'].includes(reason)) {
      void queryClient.invalidateQueries({ queryKey: trpc.signatures.pathKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.pathKey() });
    }
    toast.add({ title: t(reason as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
}
