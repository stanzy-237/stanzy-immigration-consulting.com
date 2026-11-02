import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';
import { useTRPC } from '@/trpc/client';

/** The reasons the documents router (and the upload) give that the person can act on. */
const KNOWN = [
  'DOSSIER_CLOSED',
  'DOSSIER_SECTION_NOT_EMPTY',
  'DOSSIER_FINALES_LOCKED',
  'DOSSIER_FILES_UNCONFIGURED',
  'DOCUMENT_FILE_TYPE',
  'DOCUMENT_FILE_TOO_LARGE',
  'DOCUMENT_FILE_INVALID',
];

/**
 * For a mutation on a Dossier's documents: `refresh` re-reads its Sections,
 * `failed` toasts the reason it was refused (and refreshes when the page was
 * out of date).
 */
export function useDocumentsMutation(dossierId: string) {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
  const failed = (error: { message: string }) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    if (reason === 'DOSSIER_CLOSED' || reason === 'DOSSIER_FINALES_LOCKED') void refresh();
    toast.add({ title: t(`errors.${reason}` as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
  return { refresh, failed };
}
