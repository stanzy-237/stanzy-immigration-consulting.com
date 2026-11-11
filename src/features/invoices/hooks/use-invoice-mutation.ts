import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';
import { useTRPC } from '@/trpc/client';

const KNOWN = [
  'INVOICE_EMPTY',
  'INVOICE_NOT_DRAFT',
  'INVOICE_NOT_PAYABLE',
  'DOSSIER_FILES_UNCONFIGURED',
  'DOCUMENT_FILE_TYPE',
  'DOCUMENT_FILE_TOO_LARGE',
  'DOCUMENT_FILE_INVALID',
  'PAYMENT_TOO_HIGH',
  'SIGNATURE_ASSETS_MISSING',
  'PAYMENT_NOTE_REQUIRED',
  'RECEIPT_NOT_PENDING',
  'RECEIPT_NOT_YOURS',
  'SIGNATURE_DOCUMENT_CHANGED',
  'SIGNATURE_IMAGE_INVALID',
];

/**
 * For a mutation on Factures: `refresh` re-reads every invoice query (the
 * list, one invoice, a Dossier's), `failed` toasts the reason it was refused
 * and refreshes when the page was out of date.
 */
export function useInvoiceMutation() {
  const t = useTranslations('Invoices');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.invoices.pathKey() });
  const failed = (error: { message: string }) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    if (reason === 'INVOICE_NOT_DRAFT' || reason === 'INVOICE_NOT_PAYABLE') {
      void refresh();
      toast.add({ title: t('toast.changed'), type: 'warning' });
      return;
    }
    toast.add({ title: t(`errors.${reason}` as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
  return { refresh, failed };
}
