import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';
import type { SectionsData } from '@/features/dossiers/lib/documents-cache';
import { optimisticUpdate } from '@/lib/optimistic-list';
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
  'COMMENT_NOT_YOURS',
  'CONCERNS_CLIENT_ONLY',
  'CONCERNS_NOT_OFFERED',
  'DOCUMENT_IS_FORM',
];

/**
 * For a mutation on a Dossier's documents: `refresh` re-reads its Sections;
 * `failed` toasts the reason it was refused (and refreshes when the page was
 * out of date); `optimistic(apply, success)` gives mutation options that
 * change the screen at once with `apply` (see `documents-cache`), toast
 * `success` once the server confirms, and put things back on a refusal.
 */
export function useDocumentsMutation(dossierId: string) {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.dossiers.documents.sections.queryKey({ dossierId });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const failed = (error: { message: string }) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    if (reason === 'DOSSIER_CLOSED' || reason === 'DOSSIER_FINALES_LOCKED') void refresh();
    toast.add({ title: t(`errors.${reason}` as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };

  function optimistic<Input>(
    apply: (data: SectionsData, input: Input) => SectionsData,
    success: (input: Input) => string,
  ) {
    const update = optimisticUpdate<SectionsData, Input>(queryClient, queryKey, apply);
    return {
      onMutate: update.onMutate,
      onSuccess: (_result: unknown, input: Input) => toast.add({ title: success(input), type: 'success' }),
      onError: (error: { message: string }, input: Input, context: { previous?: SectionsData } | undefined) => {
        update.onError(error, input, context);
        failed(error);
      },
      onSettled: update.onSettled,
    };
  }

  return { refresh, failed, optimistic };
}
