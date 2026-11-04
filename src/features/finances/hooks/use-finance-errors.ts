'use client';

import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';

const KNOWN = [
  'INCOME_SOURCE_MISSING',
  'FINANCE_DOSSIER_UNKNOWN',
  'CHARGE_CATEGORY_CLOSED',
  'CHARGE_CATEGORY_TAKEN',
  'CHARGE_COPY_CANNOT_REPEAT',
  'DOCUMENT_FILE_TYPE',
  'DOCUMENT_FILE_TOO_LARGE',
  'DOCUMENT_FILE_INVALID',
  'DOSSIER_FILES_UNCONFIGURED',
];

/** Toasts why a Finances action was refused. */
export function useFinanceErrors(): (error: { message: string }) => void {
  const t = useTranslations('Finances.errors');
  return (error) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    toast.add({ title: t(reason as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
}
