'use client';

import { useTranslations } from 'next-intl';

import { toast } from '@/components/ui/toast';

const KNOWN = [
  'MEETING_IN_PAST',
  'MEETING_NOT_SCHEDULED',
  'MEETING_NOT_OPEN',
  'MEETING_CONSENT_REQUIRED',
  'MEETINGS_UNCONFIGURED',
  'DOSSIER_CLOSED',
];

/** Toasts why a Réunion action was refused. */
export function useMeetingErrors(): (error: { message: string }) => void {
  const t = useTranslations('Meetings.errors');
  return (error) => {
    const reason = KNOWN.includes(error.message) ? error.message : 'UNKNOWN';
    toast.add({ title: t(reason as never), type: reason === 'UNKNOWN' ? 'error' : 'warning' });
  };
}
